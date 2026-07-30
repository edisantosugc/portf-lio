// supabase/functions/instagram-webhook/index.ts
//
// O cérebro do motor de automação: recebe do Meta os comentários e as
// mensagens (incluindo toques em botão via postback e quick_reply) do
// Instagram, acha a automação certa e entrega o conteúdo, sempre passando
// pelo freio de envio antes de mandar.
//
// IMPORTANTE: esta função precisa ser publicada como PÚBLICA (sem a
// verificação de JWT do Supabase), porque quem chama é o servidor da Meta,
// não alguém logado no painel. Ver LEIA-ME-INSTAGRAM.md.

import {
  IG_ACCOUNT_ID,
  TEST_IG_ACCOUNTS,
  acharAutomacao,
  criarClienteSupabase,
  enviarMensagemDireta,
  enviarPasso,
  enviarRespostaPrivada,
  escolherVariante,
  pegarFichaDeEnvio,
  registrarResultadoDoEnvio,
  responderComentario,
} from "../_shared/ig.ts";
import type { Automacao } from "../_shared/ig.ts";

const APP_SECRET = Deno.env.get("APP_SECRET") ?? "";
const APP_SECRET_ENFORCE = (Deno.env.get("APP_SECRET_ENFORCE") ?? "false") === "true";
const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") ?? "";

const supabase = criarClienteSupabase();

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ---------- Verificação (aperto de mão com o Meta for Developers) ----------
  if (req.method === "GET") {
    const modo = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const desafio = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(desafio ?? "", { status: 200 });
    }
    return new Response("Token de verificação inválido.", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Método não suportado.", { status: 405 });
  }

  const corpoBruto = await req.text();

  const assinaturaOk = await conferirAssinatura(corpoBruto, req.headers.get("x-hub-signature-256"));
  if (!assinaturaOk) {
    console.warn("Assinatura do webhook inválida ou ausente (x-hub-signature-256).");
    if (APP_SECRET_ENFORCE) {
      return new Response("Assinatura inválida.", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(corpoBruto);
  } catch {
    return new Response("JSON inválido.", { status: 400 });
  }

  for (const entrada of payload.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      if (mudanca.field === "comments") {
        await handleComment(mudanca.value).catch((erro) => console.error("Erro em handleComment:", erro));
      }
    }
    for (const evento of entrada.messaging ?? []) {
      await handleMessage(evento).catch((erro) => console.error("Erro em handleMessage:", erro));
    }
  }

  // A Meta espera 200 rápido; sempre respondemos ok (um erro interno, se
  // houve, já foi logado acima), pra Meta não ficar reenviando o mesmo evento.
  return new Response("EVENT_RECEIVED", { status: 200 });
});

async function conferirAssinatura(corpo: string, cabecalho: string | null): Promise<boolean> {
  if (!APP_SECRET || !cabecalho) return false;
  const esperada = cabecalho.replace("sha256=", "");
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bufferAssinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  const calculada = [...new Uint8Array(bufferAssinatura)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return calculada === esperada;
}

// ===================== COMENTÁRIOS =====================

async function handleComment(valor: any) {
  const comentarioId: string | undefined = valor?.id;
  const texto: string = valor?.text ?? "";
  const autorId: string | undefined = valor?.from?.id;
  const autorUsername: string | undefined = valor?.from?.username;
  const mediaId: string | undefined = valor?.media?.id;

  if (!comentarioId || !autorId) return;

  // Ignora comentário feito pela própria conta (dono do post)
  if (autorId === IG_ACCOUNT_ID) return;

  const { data: automacoes } = await supabase.from("ig_automations").select("*").eq("active", true);
  const automacao = acharAutomacao((automacoes ?? []) as Automacao[], texto, mediaId);

  // Loga TODO comentário (bate automação ou não), pra alimentar "quem mais
  // comenta" e as análises de conteúdo. on conflict ignora reenvios do mesmo evento.
  await supabase.from("ig_comments").insert({
    comment_id: comentarioId,
    ig_user_id: autorId,
    username: autorUsername,
    media_id: mediaId,
    texto,
    automation_id: automacao?.id ?? null,
  });

  if (!automacao) return;

  const ehContaDeTeste = TEST_IG_ACCOUNTS.includes(autorId);

  // Regra do "1 por dia": pula se essa pessoa já recebeu uma DM ok nas últimas 24h
  if (!ehContaDeTeste) {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: entregaRecente } = await supabase
      .from("ig_deliveries")
      .select("id")
      .eq("ig_user_id", autorId)
      .eq("status", "ok")
      .gte("ts", desde)
      .limit(1);
    if (entregaRecente && entregaRecente.length > 0) return;
  }

  // Dedup: cada comment_id só entra uma vez na fila (unique constraint). Se o
  // insert não voltar linha, é um reenvio do mesmo evento pela Meta.
  const { data: linhaFila, error: erroFila } = await supabase
    .from("ig_send_queue")
    .insert({
      comment_id: comentarioId,
      automation_id: automacao.id,
      ig_user_id: autorId,
      username: autorUsername,
    })
    .select("id")
    .single();

  if (erroFila || !linhaFila) return;

  const resultado = await entregarAutomacao(automacao, autorId, comentarioId, ehContaDeTeste);

  // Responde no comentário (resposta pública, com variação A/B) se saiu ou está
  // garantido na fila. Só marca o lead se realmente saiu (permite retry se falhou).
  if (resultado === "ok" || resultado === "na_fila") {
    await responderNoComentarioComVariante(automacao, comentarioId);
  }
  if (resultado === "ok") {
    await upsertLead(autorId, autorUsername, "comment", texto, automacao.id, automacao.flow?.steps?.[0]?.id);
  }
}

async function responderNoComentarioComVariante(automacao: Automacao, comentarioId: string) {
  const variantes = automacao.public_reply_variants?.length
    ? automacao.public_reply_variants
    : (automacao.public_reply ? [automacao.public_reply] : []);
  if (variantes.length === 0) return;

  // Alterna as variações A/B com base em quantas vezes essa automação já entregou
  const { count } = await supabase
    .from("ig_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("automation_id", automacao.id);

  const texto = escolherVariante(variantes, count ?? 0);
  if (!texto) return;

  await responderComentario(comentarioId, texto).catch((erro) =>
    console.error("Erro ao responder o comentário publicamente:", erro)
  );
}

// Entrega o primeiro passo do flow por resposta privada ao comentário, passando
// pelo freio. Retorna "ok" | "na_fila" | "erro".
async function entregarAutomacao(
  automacao: Automacao,
  igUserId: string,
  comentarioId: string,
  ehContaDeTeste: boolean,
): Promise<"ok" | "na_fila" | "erro"> {
  const passo0 = automacao.flow?.steps?.[0];
  if (!passo0) return "erro";

  const temFicha = ehContaDeTeste || (await pegarFichaDeEnvio(supabase));
  if (!temFicha) {
    await supabase.from("ig_deliveries").insert({
      ig_user_id: igUserId,
      automation_id: automacao.id,
      canal: "private_reply",
      tipo: "flow",
      status: "na_fila",
      motivo: "sem ficha de envio disponível no momento",
    });
    return "na_fila";
  }

  const resultado = await enviarPasso(automacao, passo0, (corpo) => enviarRespostaPrivada(comentarioId, corpo));

  if (!ehContaDeTeste) await registrarResultadoDoEnvio(supabase, resultado.ok, resultado.duro);
  if (resultado.mid) await supabase.from("ig_bot_sends").insert({ mid: resultado.mid }).select().maybeSingle();

  await supabase.from("ig_deliveries").insert({
    ig_user_id: igUserId,
    automation_id: automacao.id,
    canal: "private_reply",
    tipo: "flow",
    status: resultado.ok ? "ok" : "erro",
    motivo: resultado.ok ? null : "falha ao enviar pela Graph API",
  });

  await supabase
    .from("ig_send_queue")
    .update({
      status: resultado.ok ? "enviado" : "erro",
      sent_at: resultado.ok ? new Date().toISOString() : null,
      last_error: resultado.ok ? null : "falha ao enviar",
    })
    .eq("comment_id", comentarioId);

  return resultado.ok ? "ok" : "erro";
}

async function upsertLead(
  igUserId: string,
  username: string | undefined,
  fonte: "comment" | "dm" | "story_reply",
  ultimaKeyword: string,
  automationId: string,
  flowStep: number | undefined,
) {
  await supabase.from("ig_leads").upsert({
    ig_user_id: igUserId,
    username,
    last_source: fonte,
    last_keyword: ultimaKeyword,
    automation_id: automationId,
    flow_step: flowStep !== undefined ? String(flowStep) : null,
    updated_at: new Date().toISOString(),
  });
}

// ===================== MENSAGENS / POSTBACK / QUICK REPLY =====================

async function handleMessage(evento: any) {
  const remetenteId: string | undefined = evento?.sender?.id;
  if (!remetenteId) return;

  // Ignora "echo" (mensagem que a própria conta mandou) e eventos duplicados:
  // o mid já estaria em ig_bot_sends porque fomos nós que enviamos.
  if (evento?.message?.is_echo) return;
  const mid: string | undefined = evento?.message?.mid;
  if (mid) {
    const { data: jaEnviamos } = await supabase.from("ig_bot_sends").select("mid").eq("mid", mid).maybeSingle();
    if (jaEnviamos) return;
  }

  const payload: string | undefined = evento?.postback?.payload ?? evento?.message?.quick_reply?.payload;

  if (payload && payload.startsWith("STEP:")) {
    const [, automacaoId, passoIdTexto] = payload.split(":");
    await avancarConversa(remetenteId, automacaoId, Number(passoIdTexto));
    return;
  }

  if (payload && payload.startsWith("URL:")) {
    // Botão de link enviado como quick_reply: o toque já abriu o link no
    // próprio Instagram, não precisamos mandar nada de volta.
    return;
  }

  const textoRecebido: string | undefined = evento?.message?.text;
  if (!textoRecebido) return;

  const { data: lead } = await supabase.from("ig_leads").select("*").eq("ig_user_id", remetenteId).maybeSingle();
  if (lead?.expecting?.field && lead?.automation_id) {
    await tratarColetaDeDado(lead, textoRecebido.trim());
    return;
  }

  // Mensagem de texto solta que não bate com nada esperado: silêncio, como pedido.
}

async function avancarConversa(igUserId: string, automacaoId: string, passoId: number) {
  const { data: automacao } = await supabase.from("ig_automations").select("*").eq("id", automacaoId).maybeSingle();
  if (!automacao) return;

  const passo = (automacao.flow?.steps ?? []).find((s: any) => Number(s.id) === passoId);
  if (!passo) return;

  await supabase.from("ig_leads").upsert({
    ig_user_id: igUserId,
    automation_id: automacaoId,
    flow_step: String(passoId),
    expecting: passo.collect?.field ? { field: passo.collect.field, next: passo.collect.next } : null,
    updated_at: new Date().toISOString(),
  });

  if (passo.delay?.seconds) {
    await supabase.from("ig_scheduled").insert({
      ig_user_id: igUserId,
      automation_id: automacaoId,
      step_id: passo.delay.next,
      send_at: new Date(Date.now() + passo.delay.seconds * 1000).toISOString(),
    });
    return;
  }

  const resultado = await enviarPasso(automacao as Automacao, passo, (corpo) => enviarMensagemDireta(igUserId, corpo));
  if (resultado.mid) await supabase.from("ig_bot_sends").insert({ mid: resultado.mid }).select().maybeSingle();

  await supabase.from("ig_deliveries").insert({
    ig_user_id: igUserId,
    automation_id: automacaoId,
    canal: "dm",
    tipo: "flow",
    status: resultado.ok ? "ok" : "erro",
  });
}

async function tratarColetaDeDado(lead: any, textoRecebido: string) {
  const campo = lead.expecting.field as "email" | "telefone";

  if (campo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textoRecebido)) {
    await enviarMensagemDireta(lead.ig_user_id, { text: "Esse e-mail não parece válido. Pode mandar de novo?" });
    return;
  }
  if (campo === "telefone" && textoRecebido.replace(/\D/g, "").length < 10) {
    await enviarMensagemDireta(lead.ig_user_id, {
      text: "Esse telefone não parece completo. Pode mandar de novo, com DDD?",
    });
    return;
  }

  const atualizacao: Record<string, unknown> = { expecting: null, updated_at: new Date().toISOString() };
  atualizacao[campo] = textoRecebido;
  await supabase.from("ig_leads").update(atualizacao).eq("ig_user_id", lead.ig_user_id);

  const proximoPassoId = lead.expecting.next;
  if (proximoPassoId !== undefined && proximoPassoId !== null) {
    await avancarConversa(lead.ig_user_id, lead.automation_id, Number(proximoPassoId));
  }
}
