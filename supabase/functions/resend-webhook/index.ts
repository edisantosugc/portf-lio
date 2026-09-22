// supabase/functions/resend-webhook/index.ts
//
// Recebe os avisos automáticos que o Resend manda quando o status de um
// e-mail muda de verdade (entregue, atrasado, voltou/bounce, reclamação de
// spam) e atualiza a linha correspondente em email_envios — assim o
// Histórico de envios do painel mostra o status real sem precisar abrir o
// dashboard do Resend.
//
// Precisa ser criada no Supabase com "Verify JWT" DESLIGADO — o Resend não
// manda token de autenticação do Supabase, ele manda a própria assinatura
// (cabeçalhos svix-*), conferida abaixo com RESEND_WEBHOOK_SECRET.
//
// Depois de criar essa function e configurar o webhook lá no Resend
// (Settings > Webhooks > Add Endpoint, apontando pra URL desta function,
// eventos: email.delivered, email.delivery_delayed, email.bounced,
// email.complained), o Resend mostra um "Signing Secret" (começa com
// "whsec_") — cola esse valor como o secret RESEND_WEBHOOK_SECRET desta
// function.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Traduz o tipo de evento do Resend pro status que aparece no painel — eventos que não
// interessam pro Histórico (aberturas, cliques) são ignorados.
const EVENTO_PARA_STATUS: Record<string, string> = {
  "email.delivered": "entregue",
  "email.delivery_delayed": "atrasado",
  "email.bounced": "bounced",
  "email.complained": "reclamou",
};

function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function bytesParaBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

// Confere a assinatura Svix (formato usado pelos webhooks do Resend) — sem isso, qualquer
// um que descobrisse essa URL poderia forjar avisos de entrega falsos.
async function assinaturaValida(corpoTexto: string, svixId: string, svixTimestamp: string, svixSignature: string): Promise<boolean> {
  if (!RESEND_WEBHOOK_SECRET || !svixId || !svixTimestamp || !svixSignature) return false;

  const segredoBase64 = RESEND_WEBHOOK_SECRET.replace(/^whsec_/, "");
  const chave = await crypto.subtle.importKey(
    "raw",
    base64ParaBytes(segredoBase64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const conteudoAssinado = `${svixId}.${svixTimestamp}.${corpoTexto}`;
  const assinaturaCalculada = bytesParaBase64(
    await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(conteudoAssinado)),
  );

  // O cabeçalho pode trazer mais de uma assinatura ("v1,base64 v1,base64...") — basta uma bater.
  return svixSignature.split(" ").some(parte => parte.split(",")[1] === assinaturaCalculada);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido.", { status: 405 });
  }

  const corpoTexto = await req.text();

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!(await assinaturaValida(corpoTexto, svixId, svixTimestamp, svixSignature))) {
    return new Response("Assinatura inválida.", { status: 401 });
  }

  let evento: Record<string, unknown> = {};
  try {
    evento = JSON.parse(corpoTexto);
  } catch (_erro) {
    return new Response("Corpo inválido.", { status: 400 });
  }

  const tipo = String(evento?.type ?? "");
  const status = EVENTO_PARA_STATUS[tipo];
  if (!status) {
    // Evento que não rastreamos (ex: email.sent, email.opened, email.clicked) — confirma
    // recebido sem fazer nada, pra o Resend não ficar tentando reentregar o aviso.
    return new Response("Ignorado.", { status: 200 });
  }

  const dados = (evento?.data ?? {}) as Record<string, unknown>;
  const emailId = String(dados?.email_id ?? "");
  if (!emailId) {
    return new Response("Sem email_id.", { status: 200 });
  }

  const detalhe = tipo === "email.bounced" || tipo === "email.complained"
    ? JSON.stringify(dados).slice(0, 500)
    : null;

  await supabase
    .from("email_envios")
    .update({
      status_entrega: status,
      status_entrega_detalhe: detalhe,
      status_entrega_atualizado_em: new Date().toISOString(),
    })
    .eq("resend_id", emailId);

  return new Response("Ok.", { status: 200 });
});
