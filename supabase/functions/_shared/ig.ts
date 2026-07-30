// supabase/functions/_shared/ig.ts
//
// Funções e constantes compartilhadas entre as Edge Functions do motor de
// automação do Instagram (instagram-webhook, ig-scheduler, ig-token-refresh,
// ig-insights, ig-media). Mantém a lógica de envio, freio e montagem de
// mensagem num só lugar, pra não duplicar entre as funções.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const IG_ACCESS_TOKEN = Deno.env.get("IG_ACCESS_TOKEN") ?? "";
export const IG_ACCOUNT_ID = Deno.env.get("IG_ACCOUNT_ID") ?? "";
export const GRAPH_API_VERSION = Deno.env.get("GRAPH_API_VERSION") ?? "v21.0";
export const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Ids numéricos (separados por vírgula) de contas de teste, que ignoram a
// regra do "1 por dia" pra dar pra testar a automação à vontade.
export const TEST_IG_ACCOUNTS = (Deno.env.get("TEST_IG_ACCOUNTS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export function criarClienteSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export type Botao = { title: string; next?: number; url?: string };
export type Passo = {
  id: number;
  message: string;
  buttons?: Botao[];
  assets?: string[];
  collect?: { field: string; next: number };
  delay?: { seconds: number; next: number };
};
export type Flow = { steps: Passo[] };
export type Automacao = {
  id: string;
  nome: string;
  keyword: string;
  match_any: boolean;
  active: boolean;
  media_ids: string[];
  public_reply: string;
  public_reply_variants: string[];
  flow: Flow;
  asset_ids: string[];
};

// ===================== FREIO DE ENVIO (token bucket) =====================

export async function pegarFichaDeEnvio(supabase: SupabaseClient, chave = "private_reply"): Promise<boolean> {
  const { data, error } = await supabase.rpc("take_send_slot", { p_key: chave });
  if (error) {
    console.error("Erro ao chamar take_send_slot:", error);
    return false;
  }
  return Boolean(data);
}

export async function registrarResultadoDoEnvio(
  supabase: SupabaseClient,
  ok: boolean,
  duro: boolean,
  chave = "private_reply",
): Promise<void> {
  const { error } = await supabase.rpc("record_send_result", { p_key: chave, p_ok: ok, p_hard: duro });
  if (error) console.error("Erro ao chamar record_send_result:", error);
}

// ===================== ACHAR A AUTOMAÇÃO CERTA =====================

// Casa a palavra-chave (ou "qualquer palavra") E o post (media_ids vazio = qualquer post).
// Considera só automações ativas, na ordem em que vierem (a primeira que bater, ganha).
export function acharAutomacao(
  automacoes: Automacao[],
  textoComentario: string,
  mediaId: string | undefined,
): Automacao | null {
  const texto = (textoComentario ?? "").toLowerCase();

  for (const automacao of automacoes) {
    if (!automacao.active) continue;

    const valePraEssePost =
      !automacao.media_ids || automacao.media_ids.length === 0 ||
      (mediaId ? automacao.media_ids.includes(mediaId) : false);
    if (!valePraEssePost) continue;

    if (automacao.match_any) return automacao;

    const palavras = (automacao.keyword ?? "")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (palavras.some((p) => texto.includes(p))) return automacao;
  }

  return null;
}

export function escolherVariante(variantes: string[], indice: number): string {
  if (!variantes || variantes.length === 0) return "";
  return variantes[((indice % variantes.length) + variantes.length) % variantes.length];
}

// ===================== ENVIO PRA API DO INSTAGRAM =====================

async function chamarGraph(caminho: string, corpo: unknown): Promise<{ ok: boolean; dados: any; duro: boolean }> {
  const resposta = await fetch(`${GRAPH_BASE}${caminho}?access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    console.error("Erro da Graph API em", caminho, ":", resposta.status, JSON.stringify(dados));
    // Códigos que indicam bloqueio/restrição de verdade (falha "dura", alimenta o
    // disjuntor), em vez de um erro pontual (payload malformado, etc).
    const codigo = dados?.error?.code;
    const duro = codigo === 10 || codigo === 4 || codigo === 80007 || resposta.status === 429;
    return { ok: false, dados, duro };
  }

  return { ok: true, dados, duro: false };
}

// Responde publicamente um comentário (o texto que a pessoa vê embaixo do post dela)
export async function responderComentario(comentarioId: string, texto: string) {
  return chamarGraph(`/${comentarioId}/replies`, { message: texto });
}

// Manda uma "private reply" pro autor de um comentário: é isso que abre a janela de DM
export async function enviarRespostaPrivada(comentarioId: string, corpoDaMensagem: unknown) {
  return chamarGraph(`/${IG_ACCOUNT_ID}/messages`, {
    recipient: { comment_id: comentarioId },
    message: corpoDaMensagem,
  });
}

// Manda uma mensagem direta pra quem já está na janela de 24h (postback, quick reply, delay)
export async function enviarMensagemDireta(igUserId: string, corpoDaMensagem: unknown) {
  return chamarGraph(`/${IG_ACCOUNT_ID}/messages`, {
    recipient: { id: igUserId },
    message: corpoDaMensagem,
  });
}

// Monta os botões anexados (button template do Instagram). Botão sem next e sem
// url é descartado (equivale a "encerrar", não é enviado). Máximo de 3 nesse formato.
function montarBotoesAnexados(automacaoId: string, botoes: Botao[]) {
  return botoes.slice(0, 3).map((b) => {
    if (b.url) {
      return { type: "web_url", url: b.url, title: (b.title || "Acessar").slice(0, 20) };
    }
    return {
      type: "postback",
      title: (b.title || "Continuar").slice(0, 20),
      payload: `STEP:${automacaoId}:${b.next}`,
    };
  });
}

// Fallback em pílulas (quick_reply): cabem até 13, mais que o formato anexado
function montarQuickReplies(automacaoId: string, botoes: Botao[]) {
  return botoes.slice(0, 13).map((b) => ({
    content_type: "text",
    title: (b.title || "Continuar").slice(0, 20),
    payload: b.url ? `URL:${encodeURIComponent(b.url)}` : `STEP:${automacaoId}:${b.next}`,
  }));
}

// Envia um passo do flow com os botões ANEXADOS (button template). Se o Instagram
// recusar, tenta como quick_reply (pílula), e por último como texto puro (com o
// link no texto, se houver), pra a mensagem nunca deixar de chegar.
export async function enviarPasso(
  automacao: Automacao,
  passo: Passo,
  enviar: (corpo: unknown) => Promise<{ ok: boolean; dados: any; duro: boolean }>,
): Promise<{ ok: boolean; duro: boolean; mid?: string }> {
  const botoesValidos = (passo.buttons ?? []).filter((b) => b.next !== undefined || b.url);

  if (botoesValidos.length > 0) {
    const tentativaTemplate = await enviar({
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: (passo.message || ".").slice(0, 640),
          buttons: montarBotoesAnexados(automacao.id, botoesValidos),
        },
      },
    });
    if (tentativaTemplate.ok) {
      return { ok: true, duro: false, mid: tentativaTemplate.dados?.message_id };
    }

    const tentativaQuickReply = await enviar({
      text: (passo.message || ".").slice(0, 1000),
      quick_replies: montarQuickReplies(automacao.id, botoesValidos),
    });
    if (tentativaQuickReply.ok) {
      return { ok: true, duro: false, mid: tentativaQuickReply.dados?.message_id };
    }

    const linkDoBotao = botoesValidos.find((b) => b.url)?.url;
    const textoComLink = linkDoBotao ? `${passo.message}\n\n${linkDoBotao}` : passo.message;
    const tentativaTexto = await enviar({ text: (textoComLink || ".").slice(0, 1000) });
    return { ok: tentativaTexto.ok, duro: tentativaTexto.duro, mid: tentativaTexto.dados?.message_id };
  }

  const tentativaTexto = await enviar({ text: (passo.message || ".").slice(0, 1000) });
  return { ok: tentativaTexto.ok, duro: tentativaTexto.duro, mid: tentativaTexto.dados?.message_id };
}
