// =========================================================================
// assistente-mcp — Conector do Claude (claude.ai) para a aba "Assistente"
//
// O que tem aqui:
//  1. Um "porteiro" OAuth próprio (com PKCE). O crachá (token) que ele entrega
//     só funciona AQUI DENTRO: não vale como login do Supabase nem abre nenhuma
//     outra parte do aplicativo. Os crachás ficam guardados só como "impressão
//     digital" (hash), nunca o valor de verdade.
//  2. O servidor MCP (Streamable HTTP, sem sessão), que fala tanto a versão
//     nova do protocolo (2026-07-28) quanto as anteriores (com "initialize").
//  3. As 11 ações combinadas — e NENHUMA outra. Sem apagar nada.
//
// Segurança:
//  - Só toca nas tabelas assistente_* (pendências, indicações, lembretes,
//    passagens e as tabelas internas do porteiro). Nada de financeiro etc.
//  - O banco também bloqueia apagar nessas tabelas (ver assistente_setup.sql).
//  - Só o e-mail da dona consegue autorizar (com senha, na página
//    edilainesantos.com/conectar-claude/).
//  - O retorno do login só pode ir pro endereço oficial do Claude.
//
// Publicar: Supabase > Edge Functions > nome "assistente-mcp", com
// "Verify JWT" DESLIGADO (o porteiro daqui faz a própria checagem).
// Não precisa cadastrar nenhuma chave: SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega sozinho.
// =========================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---------- Configuração ----------
const DONA_EMAIL = "edilainesantosugc@gmail.com";
const BASE = "https://dqtoxxngjqyoibdgmrjr.supabase.co/functions/v1/assistente-mcp";
const MCP_URL = `${BASE}/mcp`;
const PAGINA_AUTORIZACAO = "https://edilainesantos.com/conectar-claude/";

// Únicos endereços pra onde o código de autorização pode voltar (os do Claude)
const REDIRECTS_PERMITIDOS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];
// Páginas que podem chamar /validar, /aprovar, /negar, /revogar-tudo pelo navegador
const ORIGENS_PAGINA = [
  "https://edilainesantos.com",
  "https://www.edilainesantos.com",
  "http://localhost:8765",
];
// Origens aceitas no endpoint MCP (o Claude chama de servidor, normalmente sem Origin)
const ORIGENS_MCP = ["https://claude.ai", "https://claude.com"];

const VALIDADE_CODIGO_MS = 10 * 60 * 1000;          // 10 minutos
const VALIDADE_ACESSO_S = 60 * 60;                  // 1 hora
const VALIDADE_RENOVACAO_MS = 30 * 24 * 3600 * 1000; // 30 dias
const MAX_CLIENTES = 100;

const VERSAO_MODERNA = "2026-07-28";
const VERSOES_LEGADAS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "assistente-edi", version: "1.0.0" };
const INSTRUCOES =
  "Conector da aba Assistente do painel da Edi: pendências, compras/indicações, lembretes e o prompt de passagem. " +
  "Não existe apagar: para tirar algo da lista, mude o status (ex.: Feito, Desisti). " +
  "Prioridade das pendências: 1 = traz dinheiro, 2 = destrava postagens, 3 = conteúdo novo, 4 = pessoal/sem prioridade.";

// ---------- Utilitários ----------
function json(corpo: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function aleatorio(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Bytes(texto: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}
async function hashHex(texto: string) {
  return [...await sha256Bytes(texto)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function s256(verifier: string) {
  const b = await sha256Bytes(verifier);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function corsPagina(req: Request): Record<string, string> {
  const origem = req.headers.get("Origin") ?? "";
  if (!ORIGENS_PAGINA.includes(origem)) return {};
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function erroOAuth(error: string, descricao: string, status = 400, extra: Record<string, string> = {}) {
  return json({ error, error_description: descricao }, status, extra);
}

// ---------- Metadados (descoberta automática pelo Claude) ----------
function metadadosRecurso() {
  return {
    resource: MCP_URL,
    authorization_servers: [BASE],
    scopes_supported: ["assistente"],
    bearer_methods_supported: ["header"],
    resource_name: "Assistente da Edi",
  };
}

function metadadosPorteiro() {
  return {
    issuer: BASE,
    authorization_endpoint: PAGINA_AUTORIZACAO,
    token_endpoint: `${BASE}/token`,
    registration_endpoint: `${BASE}/register`,
    jwks_uri: `${BASE}/jwks`,
    scopes_supported: ["assistente"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

// ---------- Cadastro automático do Claude (Dynamic Client Registration) ----------
async function registrar(req: Request) {
  let corpo: any;
  try { corpo = await req.json(); } catch { return erroOAuth("invalid_client_metadata", "JSON inválido"); }
  const uris = Array.isArray(corpo?.redirect_uris) ? corpo.redirect_uris : [];
  if (!uris.length || !uris.every((u: unknown) => typeof u === "string" && REDIRECTS_PERMITIDOS.includes(u))) {
    return erroOAuth("invalid_redirect_uri", "Este conector só aceita o endereço de retorno oficial do Claude.");
  }
  const { count } = await db.from("assistente_oauth_clientes").select("client_id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_CLIENTES) return erroOAuth("invalid_client_metadata", "Limite de cadastros atingido.", 400);

  const clientId = "cli_" + aleatorio(18);
  const nome = typeof corpo?.client_name === "string" ? corpo.client_name.slice(0, 100) : "Claude";
  const { error } = await db.from("assistente_oauth_clientes").insert({ client_id: clientId, nome, redirect_uris: uris });
  if (error) { console.error("registrar:", error.message); return erroOAuth("server_error", "Falha ao cadastrar", 500); }

  return json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: nome,
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: "assistente",
  }, 201);
}

// Confere se o pedido de autorização é legítimo (antes de mostrar qualquer coisa)
async function conferirPedido(p: any) {
  if (p?.response_type !== "code") return "Tipo de resposta inválido.";
  if (typeof p?.client_id !== "string" || typeof p?.redirect_uri !== "string") return "Pedido incompleto.";
  if (typeof p?.code_challenge !== "string" || p.code_challenge.length < 43 || p.code_challenge.length > 128) return "Pedido sem proteção PKCE.";
  if (p?.code_challenge_method !== "S256") return "Método de proteção não suportado.";
  if (p?.resource && p.resource !== MCP_URL && p.resource !== BASE) return "Recurso desconhecido.";
  const { data: cliente } = await db.from("assistente_oauth_clientes").select("*").eq("client_id", p.client_id).maybeSingle();
  if (!cliente) return "Aplicativo não cadastrado.";
  if (!REDIRECTS_PERMITIDOS.includes(p.redirect_uri) || !cliente.redirect_uris.includes(p.redirect_uri)) return "Endereço de retorno não permitido.";
  return null;
}

async function emailDoLogin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user.email.toLowerCase();
}

function urlRetorno(redirectUri: string, params: Record<string, string | undefined>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

async function validar(req: Request, cors: Record<string, string>) {
  const p = await req.json().catch(() => null);
  const problema = await conferirPedido(p);
  if (problema) return json({ ok: false, erro: problema }, 400, cors);
  return json({ ok: true }, 200, cors);
}

async function aprovar(req: Request, cors: Record<string, string>) {
  const p = await req.json().catch(() => null);
  const problema = await conferirPedido(p);
  if (problema) return json({ ok: false, erro: problema }, 400, cors);
  const email = await emailDoLogin(req);
  if (email !== DONA_EMAIL) return json({ ok: false, erro: "Só a dona do painel pode autorizar." }, 403, cors);

  const codigo = "cod_" + aleatorio(32);
  const { error } = await db.from("assistente_oauth_codigos").insert({
    codigo_hash: await hashHex(codigo),
    client_id: p.client_id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    expira_em: new Date(Date.now() + VALIDADE_CODIGO_MS).toISOString(),
  });
  if (error) { console.error("aprovar:", error.message); return json({ ok: false, erro: "Falha ao gerar autorização." }, 500, cors); }
  return json({ ok: true, redirect: urlRetorno(p.redirect_uri, { code: codigo, state: p.state, iss: BASE }) }, 200, cors);
}

async function negar(req: Request, cors: Record<string, string>) {
  const p = await req.json().catch(() => null);
  const problema = await conferirPedido(p);
  if (problema) return json({ ok: false, erro: problema }, 400, cors);
  return json({ ok: true, redirect: urlRetorno(p.redirect_uri, { error: "access_denied", state: p.state, iss: BASE }) }, 200, cors);
}

async function revogarTudo(req: Request, cors: Record<string, string>) {
  const email = await emailDoLogin(req);
  if (email !== DONA_EMAIL) return json({ ok: false, erro: "Só a dona do painel pode fazer isso." }, 403, cors);
  const { error } = await db.from("assistente_oauth_tokens").update({ revogado: true }).eq("revogado", false);
  if (error) return json({ ok: false, erro: "Falha ao desconectar." }, 500, cors);
  return json({ ok: true }, 200, cors);
}

async function emitirTokens(clientId: string) {
  const acesso = "ast_" + aleatorio(32);
  const renovacao = "asr_" + aleatorio(32);
  const { error } = await db.from("assistente_oauth_tokens").insert([
    { token_hash: await hashHex(acesso), tipo: "access", client_id: clientId, expira_em: new Date(Date.now() + VALIDADE_ACESSO_S * 1000).toISOString() },
    { token_hash: await hashHex(renovacao), tipo: "refresh", client_id: clientId, expira_em: new Date(Date.now() + VALIDADE_RENOVACAO_MS).toISOString() },
  ]);
  if (error) throw error;
  return { access_token: acesso, token_type: "Bearer", expires_in: VALIDADE_ACESSO_S, refresh_token: renovacao, scope: "assistente" };
}

async function token(req: Request) {
  const tipo = req.headers.get("Content-Type") ?? "";
  let f: URLSearchParams;
  if (tipo.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    f = new URLSearchParams(Object.entries(j ?? {}).map(([k, v]) => [k, String(v)]));
  } else {
    f = new URLSearchParams(await req.text());
  }
  // limpeza oportunista do que já venceu há mais de 1 dia
  const ontem = new Date(Date.now() - 86400000).toISOString();
  db.from("assistente_oauth_codigos").delete().lt("expira_em", ontem).then(() => {});
  db.from("assistente_oauth_tokens").delete().lt("expira_em", ontem).then(() => {});

  const clientId = f.get("client_id") ?? "";
  const grant = f.get("grant_type");

  try {
    if (grant === "authorization_code") {
      const codigo = f.get("code") ?? "";
      const verifier = f.get("code_verifier") ?? "";
      if (!codigo || !verifier) return erroOAuth("invalid_request", "Faltou code ou code_verifier.");
      // Marca como usado de forma atômica: se já foi usado, não devolve linha nenhuma
      const { data: linhas } = await db.from("assistente_oauth_codigos")
        .update({ usado: true })
        .eq("codigo_hash", await hashHex(codigo)).eq("usado", false)
        .select();
      const c = linhas?.[0];
      if (!c) return erroOAuth("invalid_grant", "Código inválido ou já usado.");
      if (new Date(c.expira_em).getTime() < Date.now()) return erroOAuth("invalid_grant", "Código vencido.");
      if (clientId && c.client_id !== clientId) return erroOAuth("invalid_grant", "Código de outro aplicativo.");
      const redirect = f.get("redirect_uri");
      if (redirect && redirect !== c.redirect_uri) return erroOAuth("invalid_grant", "Endereço de retorno diferente.");
      if (await s256(verifier) !== c.code_challenge) return erroOAuth("invalid_grant", "PKCE não confere.");
      return json(await emitirTokens(c.client_id));
    }

    if (grant === "refresh_token") {
      const r = f.get("refresh_token") ?? "";
      const { data: linhas } = await db.from("assistente_oauth_tokens")
        .update({ revogado: true })
        .eq("token_hash", await hashHex(r)).eq("tipo", "refresh").eq("revogado", false)
        .select();
      const t = linhas?.[0];
      if (!t) return erroOAuth("invalid_grant", "Renovação inválida.");
      if (new Date(t.expira_em).getTime() < Date.now()) return erroOAuth("invalid_grant", "Renovação vencida.");
      if (clientId && t.client_id !== clientId) return erroOAuth("invalid_grant", "Renovação de outro aplicativo.");
      return json(await emitirTokens(t.client_id));
    }

    return erroOAuth("unsupported_grant_type", "Tipo de pedido não suportado.");
  } catch (e) {
    console.error("token:", (e as Error)?.message ?? e);
    return erroOAuth("server_error", "Falha interna.", 500);
  }
}

async function tokenValido(req: Request) {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!t.startsWith("ast_")) return false;
  const { data } = await db.from("assistente_oauth_tokens").select("expira_em, revogado")
    .eq("token_hash", await hashHex(t)).eq("tipo", "access").maybeSingle();
  return !!data && !data.revogado && new Date(data.expira_em).getTime() > Date.now();
}

// =========================================================================
// AS 11 AÇÕES
// =========================================================================
const CATEGORIAS = ["Roteiros", "Edição", "Estudos", "Projetos", "Pessoal", "Mudança", "Outros"];
const STATUS_PEND = ["Pendente", "Em andamento", "Feito"];
const STATUS_IND = ["Quero comprar", "Comprado", "Desisti"];
const STATUS_LEMB = ["Pendente", "Feito"];
const LIMITE_LISTA = 300;

class ErroUso extends Error {}

function texto(v: unknown, campo: string, max: number, obrigatorio = false): string | null | undefined {
  if (v === undefined) { if (obrigatorio) throw new ErroUso(`Campo "${campo}" é obrigatório.`); return undefined; }
  if (v === null || v === "") { if (obrigatorio) throw new ErroUso(`Campo "${campo}" é obrigatório.`); return null; }
  if (typeof v !== "string") throw new ErroUso(`Campo "${campo}" precisa ser texto.`);
  if (obrigatorio && !v.trim()) throw new ErroUso(`Campo "${campo}" é obrigatório.`);
  if (v.length > max) throw new ErroUso(`Campo "${campo}" passou de ${max} caracteres.`);
  return v;
}
function opcao(v: unknown, campo: string, lista: string[]) {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !lista.includes(v)) throw new ErroUso(`Campo "${campo}" precisa ser um destes: ${lista.join(", ")}.`);
  return v;
}
function data(v: unknown, campo: string, obrigatorio = false): string | null | undefined {
  if (v === undefined) { if (obrigatorio) throw new ErroUso(`Campo "${campo}" é obrigatório.`); return undefined; }
  if (v === null || v === "") { if (obrigatorio) throw new ErroUso(`Campo "${campo}" é obrigatório.`); return null; }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw new ErroUso(`Campo "${campo}" precisa ser uma data AAAA-MM-DD.`);
  return v;
}
function prioridade(v: unknown) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new ErroUso(`"prioridade" precisa ser 1, 2, 3 ou 4.`);
  return n;
}
function idObrigatorio(v: unknown) {
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new ErroUso(`"id" inválido.`);
  return v;
}
function semIndefinidos(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function falha(error: { message: string } | null) {
  if (error) { console.error("db:", error.message); throw new Error("Erro no banco de dados."); }
}

async function atualizar(tabela: string, id: string, campos: Record<string, unknown>) {
  const limpos = semIndefinidos(campos);
  if (!Object.keys(limpos).length) throw new ErroUso("Informe pelo menos um campo para atualizar.");
  const { data: linhas, error } = await db.from(tabela).update(limpos).eq("id", id).select();
  falha(error);
  if (!linhas?.length) throw new ErroUso("Nenhum item com esse id.");
  return linhas[0];
}

const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const ANOT_LEITURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ANOT_CRIAR = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const ANOT_EDITAR = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const FERRAMENTAS: { def: any; executar: (a: any) => Promise<unknown> }[] = [
  {
    def: {
      name: "listar_pendencias", title: "Listar pendências", annotations: ANOT_LEITURA,
      description: "Lista as pendências, ordenadas por prioridade (1 primeiro) e depois por data limite. Sem filtro de status, devolve só as que NÃO estão Feito.",
      inputSchema: { type: "object", additionalProperties: false, properties: {
        status: S("Filtrar por status", { enum: STATUS_PEND }),
        categoria: S("Filtrar por categoria", { enum: CATEGORIAS }),
        prioridade: { type: "integer", minimum: 1, maximum: 4, description: "1 traz dinheiro, 2 destrava postagens, 3 conteúdo novo, 4 pessoal/sem prioridade" },
      } },
    },
    executar: async (a) => {
      let q = db.from("assistente_pendencias").select("*");
      const st = opcao(a.status, "status", STATUS_PEND);
      q = st ? q.eq("status", st) : q.neq("status", "Feito");
      const cat = opcao(a.categoria, "categoria", CATEGORIAS); if (cat) q = q.eq("categoria", cat);
      const pr = prioridade(a.prioridade); if (pr) q = q.eq("prioridade", pr);
      const { data: linhas, error } = await q.order("prioridade").order("data_limite", { ascending: true, nullsFirst: false }).limit(LIMITE_LISTA);
      falha(error);
      return { total: linhas!.length, pendencias: linhas };
    },
  },
  {
    def: {
      name: "adicionar_pendencia", title: "Adicionar pendência", annotations: ANOT_CRIAR,
      description: "Cria uma pendência nova. Status começa como Pendente se não for informado.",
      inputSchema: { type: "object", additionalProperties: false, required: ["titulo"], properties: {
        titulo: S("Título curto"),
        descricao: S("Descrição livre (pode ser longa)"),
        categoria: S("Categoria (padrão: Outros)", { enum: CATEGORIAS }),
        prioridade: { type: "integer", minimum: 1, maximum: 4, description: "1 traz dinheiro, 2 destrava postagens, 3 conteúdo novo, 4 pessoal/sem prioridade (padrão 4)" },
        status: S("Status inicial", { enum: STATUS_PEND }),
        data_limite: S("Data limite AAAA-MM-DD (opcional)"),
      } },
    },
    executar: async (a) => {
      const linha = semIndefinidos({
        titulo: texto(a.titulo, "titulo", 300, true),
        descricao: texto(a.descricao, "descricao", 20000),
        categoria: opcao(a.categoria, "categoria", CATEGORIAS),
        prioridade: prioridade(a.prioridade),
        status: opcao(a.status, "status", STATUS_PEND),
        data_limite: data(a.data_limite, "data_limite"),
      });
      const { data: d, error } = await db.from("assistente_pendencias").insert(linha).select().single();
      falha(error);
      return { criada: d };
    },
  },
  {
    def: {
      name: "atualizar_pendencia", title: "Atualizar pendência", annotations: ANOT_EDITAR,
      description: "Muda status, prioridade, texto, categoria ou data de uma pendência. Para tirar da lista, mude o status para Feito (não existe apagar). Para limpar a data limite, envie data_limite vazio.",
      inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: {
        id: S("id da pendência"),
        titulo: S("Novo título"),
        descricao: S("Nova descrição"),
        categoria: S("Nova categoria", { enum: CATEGORIAS }),
        prioridade: { type: "integer", minimum: 1, maximum: 4 },
        status: S("Novo status", { enum: STATUS_PEND }),
        data_limite: S("Nova data limite AAAA-MM-DD, ou vazio para remover"),
      } },
    },
    executar: async (a) => ({ atualizada: await atualizar("assistente_pendencias", idObrigatorio(a.id), {
      titulo: a.titulo === undefined ? undefined : texto(a.titulo, "titulo", 300, true),
      descricao: texto(a.descricao, "descricao", 20000),
      categoria: opcao(a.categoria, "categoria", CATEGORIAS),
      prioridade: prioridade(a.prioridade),
      status: opcao(a.status, "status", STATUS_PEND),
      data_limite: data(a.data_limite, "data_limite"),
    }) }),
  },
  {
    def: {
      name: "listar_indicacoes", title: "Listar compras e indicações", annotations: ANOT_LEITURA,
      description: "Lista as indicações de compra, com quem indicou cada uma. Pode filtrar por status.",
      inputSchema: { type: "object", additionalProperties: false, properties: {
        status: S("Filtrar por status", { enum: STATUS_IND }),
      } },
    },
    executar: async (a) => {
      let q = db.from("assistente_indicacoes").select("*");
      const st = opcao(a.status, "status", STATUS_IND); if (st) q = q.eq("status", st);
      const { data: linhas, error } = await q.order("quem_indicou").order("created_at", { ascending: false }).limit(LIMITE_LISTA);
      falha(error);
      return { total: linhas!.length, indicacoes: linhas };
    },
  },
  {
    def: {
      name: "adicionar_indicacao", title: "Adicionar indicação", annotations: ANOT_CRIAR,
      description: "Cria uma indicação de compra. Status começa como Quero comprar se não for informado.",
      inputSchema: { type: "object", additionalProperties: false, required: ["produto"], properties: {
        produto: S("Produto"),
        marca_modelo: S("Marca e modelo"),
        detalhes: S("Detalhes livres"),
        quem_indicou: S("Quem indicou (ex.: Júlia Pazza, Rangel)"),
        link: S("Link (opcional)"),
        status: S("Status inicial", { enum: STATUS_IND }),
      } },
    },
    executar: async (a) => {
      const linha = semIndefinidos({
        produto: texto(a.produto, "produto", 300, true),
        marca_modelo: texto(a.marca_modelo, "marca_modelo", 300),
        detalhes: texto(a.detalhes, "detalhes", 20000),
        quem_indicou: texto(a.quem_indicou, "quem_indicou", 200),
        link: texto(a.link, "link", 2000),
        status: opcao(a.status, "status", STATUS_IND),
      });
      const { data: d, error } = await db.from("assistente_indicacoes").insert(linha).select().single();
      falha(error);
      return { criada: d };
    },
  },
  {
    def: {
      name: "atualizar_indicacao", title: "Atualizar indicação", annotations: ANOT_EDITAR,
      description: "Muda campos ou o status de uma indicação (Quero comprar, Comprado, Desisti). Não existe apagar.",
      inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: {
        id: S("id da indicação"),
        produto: S("Produto"),
        marca_modelo: S("Marca e modelo"),
        detalhes: S("Detalhes"),
        quem_indicou: S("Quem indicou"),
        link: S("Link"),
        status: S("Novo status", { enum: STATUS_IND }),
      } },
    },
    executar: async (a) => ({ atualizada: await atualizar("assistente_indicacoes", idObrigatorio(a.id), {
      produto: a.produto === undefined ? undefined : texto(a.produto, "produto", 300, true),
      marca_modelo: texto(a.marca_modelo, "marca_modelo", 300),
      detalhes: texto(a.detalhes, "detalhes", 20000),
      quem_indicou: texto(a.quem_indicou, "quem_indicou", 200),
      link: texto(a.link, "link", 2000),
      status: opcao(a.status, "status", STATUS_IND),
    }) }),
  },
  {
    def: {
      name: "listar_lembretes", title: "Listar lembretes", annotations: ANOT_LEITURA,
      description: "Lista os lembretes por data (mais próximos primeiro). Sem filtro de status, devolve só os Pendentes.",
      inputSchema: { type: "object", additionalProperties: false, properties: {
        status: S("Filtrar por status", { enum: STATUS_LEMB }),
      } },
    },
    executar: async (a) => {
      const st = opcao(a.status, "status", STATUS_LEMB) ?? "Pendente";
      const { data: linhas, error } = await db.from("assistente_lembretes").select("*").eq("status", st)
        .order("data", { ascending: st === "Pendente" }).limit(LIMITE_LISTA);
      falha(error);
      return { total: linhas!.length, lembretes: linhas };
    },
  },
  {
    def: {
      name: "adicionar_lembrete", title: "Adicionar lembrete", annotations: ANOT_CRIAR,
      description: "Cria um lembrete para uma data.",
      inputSchema: { type: "object", additionalProperties: false, required: ["texto", "data"], properties: {
        texto: S("Texto do lembrete"),
        data: S("Data AAAA-MM-DD"),
      } },
    },
    executar: async (a) => {
      const { data: d, error } = await db.from("assistente_lembretes").insert({
        texto: texto(a.texto, "texto", 2000, true),
        data: data(a.data, "data", true),
      }).select().single();
      falha(error);
      return { criado: d };
    },
  },
  {
    def: {
      name: "atualizar_lembrete", title: "Atualizar lembrete", annotations: ANOT_EDITAR,
      description: "Muda o texto, a data ou o status (Pendente/Feito) de um lembrete. Não existe apagar.",
      inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: {
        id: S("id do lembrete"),
        texto: S("Novo texto"),
        data: S("Nova data AAAA-MM-DD"),
        status: S("Novo status", { enum: STATUS_LEMB }),
      } },
    },
    executar: async (a) => ({ atualizado: await atualizar("assistente_lembretes", idObrigatorio(a.id), {
      texto: a.texto === undefined ? undefined : texto(a.texto, "texto", 2000, true),
      data: a.data === undefined ? undefined : data(a.data, "data", true),
      status: opcao(a.status, "status", STATUS_LEMB),
    }) }),
  },
  {
    def: {
      name: "ler_passagem", title: "Ler passagem atual", annotations: ANOT_LEITURA,
      description: "Devolve o prompt de passagem ATUAL (o histórico não é devolvido).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
    },
    executar: async () => {
      const { data: d, error } = await db.from("assistente_passagens").select("texto, created_at").eq("atual", true).maybeSingle();
      falha(error);
      return d ? { passagem: d.texto, salva_em: d.created_at } : { passagem: null, aviso: "Ainda não existe passagem salva." };
    },
  },
  {
    def: {
      name: "salvar_passagem", title: "Salvar passagem nova", annotations: ANOT_CRIAR,
      description: "Salva uma nova versão do prompt de passagem. A versão anterior vai automaticamente para o histórico. Envie o texto COMPLETO (substitui a atual).",
      inputSchema: { type: "object", additionalProperties: false, required: ["texto"], properties: {
        texto: S("Texto completo da nova passagem"),
      } },
    },
    executar: async (a) => {
      const t = texto(a.texto, "texto", 200000, true);
      const { data: d, error } = await db.rpc("assistente_salvar_passagem", { p_texto: t });
      falha(error);
      return { salva: true, salva_em: (d as any)?.created_at ?? null };
    },
  },
];

async function chamarFerramenta(params: any) {
  const f = FERRAMENTAS.find((x) => x.def.name === params?.name);
  if (!f) return null;
  try {
    const resultado = await f.executar(params?.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }], isError: false };
  } catch (e) {
    const msg = e instanceof ErroUso ? e.message : "Não deu pra concluir agora. Tente de novo.";
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

// =========================================================================
// SERVIDOR MCP (JSON-RPC)
// =========================================================================
const rpcErro = (id: unknown, code: number, message: string, data?: unknown) =>
  ({ jsonrpc: "2.0", id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } });

function decodificarCabecalho(v: string | null) {
  if (v === null) return null;
  const m = v.match(/^=\?base64\?(.*)\?=$/);
  if (!m) return v;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch { return "\u0000"; }
}

async function mcp(req: Request) {
  if (req.method === "GET" || req.method === "DELETE") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });

  const origem = req.headers.get("Origin");
  if (origem && !ORIGENS_MCP.includes(origem)) return json(rpcErro(null, -32600, "Origin não permitida"), 403);

  if (!(await tokenValido(req))) {
    return json({ error: "invalid_token", error_description: "Autorização necessária." }, 401, {
      "WWW-Authenticate": `Bearer realm="assistente", resource_metadata="${BASE}/.well-known/oauth-protected-resource", scope="assistente"`,
    });
  }

  let msg: any;
  try { msg = await req.json(); } catch { return json(rpcErro(null, -32700, "JSON inválido"), 400); }
  if (Array.isArray(msg) || !msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return json(rpcErro(msg?.id, -32600, "Pedido inválido"), 400);
  }

  // Notificação (sem id): só confirma
  if (msg.id === undefined) return new Response(null, { status: 202 });

  const id = msg.id;
  const params = msg.params ?? {};
  const versaoMeta = params?._meta?.["io.modelcontextprotocol/protocolVersion"];

  // ---------- Era antiga: aperto de mão "initialize" ----------
  if (msg.method === "initialize") {
    const pedida = params?.protocolVersion;
    const versao = VERSOES_LEGADAS.includes(pedida) ? pedida : VERSOES_LEGADAS[0];
    return json({ jsonrpc: "2.0", id, result: {
      protocolVersion: versao,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCOES,
    } });
  }

  // ---------- Era nova: versão e cabeçalhos em todo pedido ----------
  const moderno = typeof versaoMeta === "string";
  if (moderno) {
    if (versaoMeta !== VERSAO_MODERNA) {
      return json(rpcErro(id, -32022, "Unsupported protocol version", { supported: [VERSAO_MODERNA, ...VERSOES_LEGADAS], requested: versaoMeta }), 400);
    }
    const hVersao = req.headers.get("MCP-Protocol-Version");
    const hMetodo = req.headers.get("Mcp-Method");
    if (hVersao !== versaoMeta) return json(rpcErro(id, -32020, "Header mismatch: MCP-Protocol-Version"), 400);
    if (hMetodo !== msg.method) return json(rpcErro(id, -32020, "Header mismatch: Mcp-Method"), 400);
    if (msg.method === "tools/call" && decodificarCabecalho(req.headers.get("Mcp-Name")) !== params?.name) {
      return json(rpcErro(id, -32020, "Header mismatch: Mcp-Name"), 400);
    }
  }
  const completar = (r: Record<string, unknown>) => moderno ? { resultType: "complete", ...r } : r;

  switch (msg.method) {
    case "server/discover":
      return json({ jsonrpc: "2.0", id, result: {
        resultType: "complete",
        supportedVersions: [VERSAO_MODERNA, ...VERSOES_LEGADAS],
        capabilities: { tools: {} },
        _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO },
        instructions: INSTRUCOES,
      } });
    case "ping":
      return json({ jsonrpc: "2.0", id, result: completar({}) });
    case "tools/list":
      return json({ jsonrpc: "2.0", id, result: completar({ tools: FERRAMENTAS.map((f) => f.def) }) });
    case "tools/call": {
      const r = await chamarFerramenta(params);
      if (!r) return json(rpcErro(id, -32602, `Ação desconhecida: ${params?.name}`));
      return json({ jsonrpc: "2.0", id, result: completar(r) });
    }
    default:
      return json(rpcErro(id, -32601, "Method not found"), moderno ? 404 : 200);
  }
}

// =========================================================================
// ROTEAMENTO
// =========================================================================
Deno.serve(async (req) => {
  const url = new URL(req.url);
  // O caminho chega como "/assistente-mcp/..." — fica só o que vem depois
  const caminho = url.pathname.replace(/^.*?\/assistente-mcp/, "").replace(/\/+$/, "") || "/";
  const cors = corsPagina(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (req.method === "GET") {
      if (caminho.startsWith("/.well-known/oauth-protected-resource")) return json(metadadosRecurso());
      if (caminho === "/.well-known/oauth-authorization-server" || caminho === "/.well-known/openid-configuration") return json(metadadosPorteiro());
      if (caminho === "/jwks") return json({ keys: [] });
    }
    if (caminho === "/mcp" || caminho === "/") return await mcp(req);
    if (req.method === "POST") {
      if (caminho === "/register") return await registrar(req);
      if (caminho === "/token") return await token(req);
      if (caminho === "/validar") return await validar(req, cors);
      if (caminho === "/aprovar") return await aprovar(req, cors);
      if (caminho === "/negar") return await negar(req, cors);
      if (caminho === "/revogar-tudo") return await revogarTudo(req, cors);
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error("erro geral:", (e as Error)?.message ?? e);
    return json({ error: "server_error" }, 500, cors);
  }
});
