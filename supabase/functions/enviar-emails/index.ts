// supabase/functions/enviar-emails/index.ts
//
// Manda e-mails de prospecção em massa pelo Resend, um por um, com todo o
// cuidado que um disparo de verdade precisa: só a Edilaine pode chamar,
// no máximo 250 destinatários por chamada, pula quem pediu pra sair,
// espera entre um envio e outro (ritmo seguro do Resend), registra cada
// destinatário na tabela email_envios (pra saber exatamente quem recebeu
// se o disparo parar no meio) e para na hora se a cota diária acabar.
//
// Body esperado:
// {
//   destinatarios: [{ email, nome, marca }, ...]  // nome = primeiro nome da pessoa de contato
//   assunto: string   // pode ter {{nome}} e {{marca}}
//   html: string      // pode ter {{nome}} e {{marca}}
// }

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Só esta pessoa pode disparar e-mails por aqui — qualquer outro login autenticado é recusado.
const EMAIL_PERMITIDO = "edilainesantosugc@gmail.com";

// Pra onde a marca cai quando responde o e-mail (não é o endereço técnico de envio).
const EMAIL_RESPOSTA = "edilainesantosugc@gmail.com";

// Domínio edilainesantos.com verificado no Resend em 20/09/2026 — pode mandar pra
// qualquer marca, não só pra ela mesma.
const REMETENTE = "Edilaine Santos <contato@edilainesantos.com>";

const MAX_DESTINATARIOS_POR_CHAMADA = 250;
const ESPERA_ENTRE_ENVIOS_MS = 200; // ~5 por segundo, ritmo seguro do Resend

function trocarVariaveis(texto: string, nome: string, marca: string){
  return (texto || "").replaceAll("{{nome}}", nome || "").replaceAll("{{marca}}", marca || "");
}

function esperar(ms: number){
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  // Confere login: só a Edilaine, ninguém mais, mesmo que esteja autenticado no Supabase.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser(jwt);
  if (!jwt || erroUsuario || !dadosUsuario?.user || dadosUsuario.user.email !== EMAIL_PERMITIDO) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  if (!RESEND_API_KEY) {
    return respostaJson({ error: "RESEND_API_KEY não configurada nos secrets desta função." }, 500);
  }

  let corpoRequisicao: Record<string, unknown> = {};
  try {
    corpoRequisicao = await req.json();
  } catch (_erro) {
    return respostaJson({ error: "Corpo da requisição inválido." }, 400);
  }

  const { destinatarios, assunto, html } = corpoRequisicao as {
    destinatarios?: { email: string; nome?: string; marca?: string }[];
    assunto?: string;
    html?: string;
  };

  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return respostaJson({ error: "Nenhum destinatário informado." }, 400);
  }
  if (!assunto || !html) {
    return respostaJson({ error: "Assunto e html são obrigatórios." }, 400);
  }
  if (destinatarios.length > MAX_DESTINATARIOS_POR_CHAMADA) {
    return respostaJson({ error: `No máximo ${MAX_DESTINATARIOS_POR_CHAMADA} destinatários por chamada.` }, 400);
  }

  // Dedupe por e-mail (agências que atendem mais de uma marca com o mesmo endereço) —
  // mantém o primeiro nome/marca encontrado pra esse e-mail.
  const vistos = new Set<string>();
  const destinatariosUnicos = destinatarios.filter(d => {
    const chave = (d.email || "").trim().toLowerCase();
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  // Nunca manda pra quem pediu pra sair.
  const { data: optouts } = await supabase.from("email_optout").select("email");
  const emailsOptout = new Set((optouts ?? []).map((o: any) => (o.email || "").toLowerCase()));

  let enviados = 0;
  let falhas = 0;
  let pulados = 0;
  let cotaEsgotada = false;
  const emailsEnviados: string[] = []; // quem realmente recebeu — o painel usa isso pra marcar só essas marcas como "enviado"

  for (const destinatario of destinatariosUnicos) {
    const emailDestino = (destinatario.email || "").trim().toLowerCase();
    if (!emailDestino) { pulados++; continue; }

    if (emailsOptout.has(emailDestino)) {
      pulados++;
      continue;
    }

    const assuntoFinal = trocarVariaveis(assunto, destinatario.nome ?? "", destinatario.marca ?? "");
    const htmlFinal = trocarVariaveis(html, destinatario.nome ?? "", destinatario.marca ?? "");

    try {
      const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: REMETENTE,
          to: [emailDestino],
          subject: assuntoFinal,
          html: htmlFinal,
          reply_to: EMAIL_RESPOSTA,
          headers: {
            "List-Unsubscribe": `<mailto:${EMAIL_RESPOSTA}?subject=SAIR>`,
          },
        }),
      });

      const corpoResposta = await resposta.json().catch(() => ({}));

      if (resposta.ok) {
        enviados++;
        emailsEnviados.push(emailDestino);
        await supabase.from("email_envios").insert({
          email: emailDestino,
          assunto: assuntoFinal,
          status: "ok",
          resend_id: corpoResposta?.id ?? null,
          corpo_html: htmlFinal,
        });
      } else if (corpoResposta?.name === "daily_quota_exceeded") {
        // Para na hora — não adianta continuar tentando, todo o resto vai falhar igual.
        cotaEsgotada = true;
        break;
      } else {
        falhas++;
        await supabase.from("email_envios").insert({
          email: emailDestino,
          assunto: assuntoFinal,
          status: "erro",
          erro: corpoResposta?.message || `Erro HTTP ${resposta.status}`,
          corpo_html: htmlFinal,
        });
      }
    } catch (erroEnvio: any) {
      falhas++;
      await supabase.from("email_envios").insert({
        email: emailDestino,
        assunto: assuntoFinal,
        status: "erro",
        erro: erroEnvio?.message || "Falha de rede ao chamar o Resend",
        corpo_html: htmlFinal,
      });
    }

    await esperar(ESPERA_ENTRE_ENVIOS_MS);
  }

  const faltando = destinatariosUnicos.length - enviados - falhas - pulados;

  return respostaJson({ enviados, falhas, pulados, faltando: Math.max(0, faltando), cotaEsgotada, enviadosEmails: emailsEnviados });
});
