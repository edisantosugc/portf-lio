// =========================================================================
// ig-metricas-cronograma — métricas do Instagram no Cronograma de Conteúdos
//
// Robô NOVO e separado: não mexe nas automações de DM, nos leads, na análise
// (ig-analise-conteudo) nem no ig-media. Só LÊ do Instagram e só ESCREVE na
// tabela assistente_cronograma (colunas de métricas e do post ligado).
//
// Quem pode chamar:
//  - O agendamento diário (pg_cron, 9h), com o cabeçalho x-sched-key = SCHED_SECRET
//    (o mesmo segredo dos outros robôs, lido da app_config pelo agendamento).
//  - O painel, com o login da dona (e-mail conferido aqui).
//
// Ações (corpo JSON):
//  - { acao: "listar_posts" }            → posts recentes (pra ligar à ideia)
//  - { acao: "atualizar", id: "<uuid>" } → busca as métricas de UMA ideia agora
//  - { acao: "rodar_vencidas" }          → busca as que venceram 48h / 7 dias
//    (é o que o agendamento chama; o painel também pode chamar)
//
// Regras:
//  - Métrica marcada como digitada à mão (metricas_origem[campo] = "manual")
//    NUNCA é sobrescrita.
//  - O que o Instagram não entregar fica como está (vazio ou digitado).
//  - Erro de conexão: grava um aviso em metricas_erro, sem apagar nenhum número.
//
// Publicar com "Verify JWT" DESLIGADO (o agendamento não manda login; a
// checagem é feita aqui dentro). Usa os secrets que já existem:
// IG_ACCESS_TOKEN, IG_ACCOUNT_ID, SCHED_SECRET (e GRAPH_API_VERSION, se houver).
// =========================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const IG_ACCESS_TOKEN = Deno.env.get("IG_ACCESS_TOKEN") ?? "";
const IG_ACCOUNT_ID = Deno.env.get("IG_ACCOUNT_ID") ?? "";
const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const GRAPH_BASE = `https://graph.instagram.com/${Deno.env.get("GRAPH_API_VERSION") ?? "v21.0"}`;
const DONA_EMAIL = "edilainesantosugc@gmail.com";
const ORIGENS = ["https://edilainesantos.com", "https://www.edilainesantos.com", "http://localhost:8765"];

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Métricas pedidas ao Instagram por tipo de post → coluna do cronograma
const PEDIR: Record<string, string[]> = {
  REELS: ["views", "reach", "likes", "comments", "shares", "saved", "ig_reels_avg_watch_time", "reels_skip_rate"],
  FEED: ["views", "reach", "likes", "comments", "shares", "saved", "follows"],
};
const COLUNA: Record<string, string> = {
  views: "visualizacoes", reach: "alcance", likes: "curtidas", comments: "comentarios",
  shares: "compartilhamentos", saved: "salvamentos", follows: "seguidores_ganhos",
  ig_reels_avg_watch_time: "tempo_medio_seg", reels_skip_rate: "taxa_pulo_pct",
};

// ---------- utilitários ----------
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  return ORIGENS.includes(o)
    ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }
    : {};
}
const json = (corpo: unknown, status: number, extra: Record<string, string>) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra } });

function hojeSP() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
function somarDias(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
function tipoDoPost(m: any): "REELS" | "FEED" {
  return m?.media_product_type === "REELS" ? "REELS" : "FEED";
}

class ErroConexao extends Error {}

async function graph(caminho: string, params: Record<string, string>) {
  const u = new URL(`${GRAPH_BASE}${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", IG_ACCESS_TOKEN);
  const r = await fetch(u.toString());
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const codigo = dados?.error?.code;
    // 190 = token inválido/expirado; 10/200 = sem permissão
    if (codigo === 190 || codigo === 10 || codigo === 200 || r.status === 401) {
      throw new ErroConexao(codigo === 190 ? "A conexão com o Instagram expirou ou caiu. Os números já preenchidos foram mantidos."
        : "A conexão com o Instagram não tem permissão pra ler os números dos posts.");
    }
    return { ok: false, dados };
  }
  return { ok: true, dados };
}

// Pede as métricas; se o Instagram recusar uma delas (ex.: ainda não existe
// pra esse post), tira a recusada e tenta de novo com as outras.
async function buscarInsights(mediaId: string, tipo: "REELS" | "FEED") {
  let metricas = [...PEDIR[tipo]];
  const valores: Record<string, number> = {};
  const recusadas: string[] = [];
  for (let tentativa = 0; tentativa < 6 && metricas.length; tentativa++) {
    const r = await graph(`/${mediaId}/insights`, { metric: metricas.join(",") });
    if (r.ok) {
      for (const item of r.dados?.data ?? []) {
        const bruto = item?.values?.[0]?.value ?? item?.total_value?.value;
        if (typeof bruto === "number" && Number.isFinite(bruto)) valores[item.name] = bruto;
      }
      break;
    }
    const msg = String(r.dados?.error?.message ?? "");
    const ruim = metricas.find((m) => msg.includes(m));
    if (!ruim) { console.error("insights recusado:", msg); break; }
    recusadas.push(ruim);
    metricas = metricas.filter((m) => m !== ruim);
  }
  return { valores, recusadas };
}

function converter(nome: string, v: number): number | null {
  if (nome === "ig_reels_avg_watch_time") return Math.round((v / 1000) * 100) / 100;          // ms → segundos
  if (nome === "reels_skip_rate") { const p = v <= 1 ? v * 100 : v; return Math.min(100, Math.max(0, Math.round(p * 100) / 100)); }
  return Math.max(0, Math.round(v));
}

// Busca e grava as métricas de uma ideia (respeitando o que foi digitado à mão)
async function atualizarItem(item: any) {
  const info = await graph(`/${item.ig_media_id}`, { fields: "id,media_type,media_product_type,permalink,timestamp" });
  if (!info.ok) {
    const aviso = "Não achei esse post no Instagram (foi apagado ou arquivado?). Os números já preenchidos foram mantidos.";
    await db.from("assistente_cronograma").update({ metricas_erro: aviso }).eq("id", item.id);
    return { id: item.id, ok: false, aviso };
  }
  const tipo = tipoDoPost(info.dados);
  const { valores, recusadas } = await buscarInsights(item.ig_media_id, tipo);
  const origem: Record<string, string> = { ...(item.metricas_origem ?? {}) };
  const campos: Record<string, unknown> = {
    ig_tipo: tipo,
    metricas_atualizadas_em: new Date().toISOString(),
    metricas_erro: null,
  };
  if (info.dados?.permalink && String(info.dados.permalink).startsWith("https://")) campos.ig_permalink = info.dados.permalink;
  const preenchidas: string[] = [];
  for (const [nome, v] of Object.entries(valores)) {
    const coluna = COLUNA[nome];
    if (!coluna || origem[coluna] === "manual") continue;     // digitado à mão: nunca sobrescreve
    const valor = converter(nome, v);
    if (valor === null) continue;
    campos[coluna] = valor;
    origem[coluna] = "instagram";
    preenchidas.push(coluna);
  }
  campos.metricas_origem = origem;
  const { error } = await db.from("assistente_cronograma").update(campos).eq("id", item.id);
  if (error) { console.error("gravar métricas:", error.message); return { id: item.id, ok: false, aviso: "Falha ao gravar." }; }
  return { id: item.id, ok: true, tipo, preenchidas, recusadas, valores };
}

async function avisarErroConexao(ids: string[], aviso: string) {
  if (ids.length) await db.from("assistente_cronograma").update({ metricas_erro: aviso }).in("id", ids);
}

// ---------- ações ----------
async function listarPosts() {
  const r = await graph(`/${IG_ACCOUNT_ID}/media`, {
    fields: "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp",
    limit: "40",
  });
  if (!r.ok) throw new Error("Não consegui carregar seus posts agora.");
  const posts = (r.dados?.data ?? []).map((m: any) => ({
    id: m.id,
    legenda: String(m.caption ?? "").slice(0, 90),
    tipo: tipoDoPost(m),
    miniatura: m.thumbnail_url ?? m.media_url ?? null,
    link: m.permalink ?? null,
    data_sp: m.timestamp ? new Date(m.timestamp).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : null,
    hora_sp: m.timestamp ? new Date(m.timestamp).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : null,
  }));
  return { posts };
}

async function rodarVencidas() {
  const hoje = hojeSP();
  const { data: itens, error } = await db.from("assistente_cronograma")
    .select("id, ig_media_id, data_postagem, metricas_origem, metricas_atualizadas_em")
    .eq("lista", "Postados").not("ig_media_id", "is", null).not("data_postagem", "is", null);
  if (error) throw new Error("Falha ao ler o cronograma.");
  const vencidas = (itens ?? []).filter((it: any) => {
    const em48h = somarDias(it.data_postagem, 2), em7d = somarDias(it.data_postagem, 7);
    const ultima = it.metricas_atualizadas_em ? new Date(it.metricas_atualizadas_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : null;
    if (hoje < em48h) return false;
    if (!ultima) return true;                       // 48h: ainda não buscou nenhuma vez
    return hoje >= em7d && ultima < em7d;           // 7 dias: atualiza mais uma vez
  });
  const resultados = [];
  for (let i = 0; i < vencidas.length; i++) {
    try { resultados.push(await atualizarItem(vencidas[i])); }
    catch (e) {
      if (e instanceof ErroConexao) {
        await avisarErroConexao(vencidas.slice(i).map((x: any) => x.id), e.message);
        return { total: vencidas.length, resultados, erro_conexao: e.message };
      }
      throw e;
    }
  }
  return { total: vencidas.length, resultados };
}

// ---------- entrada ----------
Deno.serve(async (req) => {
  const c = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, c);

  // Quem está chamando?
  const chave = req.headers.get("x-sched-key") ?? "";
  let agendamento = false;
  if (chave && SCHED_SECRET && chave === SCHED_SECRET) agendamento = true;
  else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = jwt ? await db.auth.getUser(jwt) : { data: null } as any;
    if ((data?.user?.email ?? "").toLowerCase() !== DONA_EMAIL) return json({ error: "Não autorizado." }, 401, c);
  }
  if (!IG_ACCESS_TOKEN || !IG_ACCOUNT_ID) return json({ error: "Conexão com o Instagram não configurada." }, 500, c);

  const corpo = await req.json().catch(() => ({}));
  const acao = agendamento ? "rodar_vencidas" : corpo?.acao;
  try {
    if (acao === "listar_posts") return json(await listarPosts(), 200, c);
    if (acao === "rodar_vencidas") return json(await rodarVencidas(), 200, c);
    if (acao === "atualizar") {
      if (typeof corpo?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(corpo.id)) return json({ error: "id inválido" }, 400, c);
      const { data: item } = await db.from("assistente_cronograma")
        .select("id, ig_media_id, metricas_origem").eq("id", corpo.id).maybeSingle();
      if (!item) return json({ error: "Ideia não encontrada." }, 404, c);
      if (!item.ig_media_id) return json({ error: "Essa ideia ainda não tem post do Instagram ligado." }, 400, c);
      try { return json(await atualizarItem(item), 200, c); }
      catch (e) {
        if (e instanceof ErroConexao) { await avisarErroConexao([item.id], e.message); return json({ error: e.message, erro_conexao: true }, 502, c); }
        throw e;
      }
    }
    return json({ error: "Ação desconhecida." }, 400, c);
  } catch (e) {
    const msg = e instanceof ErroConexao ? e.message : "Não deu pra falar com o Instagram agora. Tenta de novo daqui a pouco.";
    console.error("ig-metricas-cronograma:", (e as Error)?.message ?? e);
    return json({ error: msg, erro_conexao: e instanceof ErroConexao }, 502, c);
  }
});
