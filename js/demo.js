/* =========================================================================
   js/demo.js — MODO DEMONSTRAÇÃO (edilainesantos.com/demo)

   Só faz alguma coisa quando a página está aberta DENTRO da demo (moldura
   chamada "edi-demo", criada por demo/index.html) ou com "?demo" no endereço.
   Fora disso, sai na primeira linha e não muda nada no site real.

   Quando ativo:
   1. Isola o armazenamento do navegador (localStorage/sessionStorage) numa área
      só da demo — a demo nunca lê nem grava a sessão/preferências do painel real.
   2. Troca a conexão com o Supabase por um "banco de mentira" em memória, já
      preenchido com dados fictícios (js/demo-dados.js). Nada é lido, gravado ou
      apagado no banco real.
   3. Bloqueia tudo que sairia pra fora (e-mails, Instagram, IA, Google Agenda,
      notificações, links externos) e devolve respostas simuladas.
   4. Troca textos fixos do código que tenham dados reais (nome, @, e-mail,
      nomes da família) pelos da criadora fictícia.

   IMPORTANTE pra quem mexer no site: texto NOVO com nome/@/e-mail real escrito
   direto no código precisa entrar em TROCAS_DE_TEXTO abaixo.
   ========================================================================= */
(function(){
  "use strict";

  const NOME_MOLDURA = "edi-demo";
  let parametros;
  try { parametros = new URLSearchParams(location.search); } catch (e) { parametros = new URLSearchParams(""); }
  const ativo = window.name === NOME_MOLDURA || parametros.has("demo");
  if (!ativo) return;
  window.name = NOME_MOLDURA; // continua em modo demo ao navegar dentro da moldura

  // Foto real nunca chega a aparecer: fica escondida até ser trocada pela ilustração
  try {
    const estilo = document.createElement("style");
    estilo.textContent = `
      img[src*="imagens/"]:not([src*="borboleta"]):not([src*="textura"]), img[src*="ytimg.com"], img[src$=".jpg"], img[src$=".jpeg"], img[src$=".png"], img[src$=".webp"]{ visibility: hidden !important; }
      [style*="imagens/"]:not([style*="textura"]), [style*="ytimg.com"], [style*=".jpg"], [style*=".png"], [style*=".webp"]{ background-image: none !important; }
    `;
    (document.head || document.documentElement).appendChild(estilo);
  } catch (e) {}

  // ---------------------------------------------------------------------------
  // 1. Armazenamento isolado
  // ---------------------------------------------------------------------------
  const PREFIXO = "edi-demo::";
  function criarArmazenamento(real, prefixo){
    const memoria = {};
    const ler = (k) => { try { return real.getItem(prefixo + k); } catch (e) { return Object.prototype.hasOwnProperty.call(memoria, k) ? memoria[k] : null; } };
    const gravar = (k, v) => { memoria[k] = String(v); try { real.setItem(prefixo + k, String(v)); } catch (e) {} };
    const chaves = () => {
      const lista = [];
      try { for (let i = 0; i < real.length; i++){ const k = real.key(i); if (k && k.startsWith(prefixo)) lista.push(k.slice(prefixo.length)); } }
      catch (e) { return Object.keys(memoria); }
      return lista;
    };
    return {
      getItem: (k) => ler(String(k)),
      setItem: (k, v) => gravar(String(k), v),
      removeItem: (k) => { delete memoria[k]; try { real.removeItem(prefixo + k); } catch (e) {} },
      clear: () => { chaves().forEach(k => { try { real.removeItem(prefixo + k); } catch (e) {} }); },
      key: (i) => chaves()[i] ?? null,
      get length(){ return chaves().length; }
    };
  }
  let lsReal = null, ssReal = null;
  try { lsReal = window.localStorage; } catch (e) {}
  try { ssReal = window.sessionStorage; } catch (e) {}
  const lsDemo = criarArmazenamento(lsReal || { getItem(){ return null; }, setItem(){}, removeItem(){}, length: 0, key(){ return null; } }, PREFIXO + "ls:");
  const ssDemo = criarArmazenamento(ssReal || { getItem(){ return null; }, setItem(){}, removeItem(){}, length: 0, key(){ return null; } }, PREFIXO + "ss:");
  try { Object.defineProperty(window, "localStorage", { configurable: true, get: () => lsDemo }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => ssDemo }); } catch (e) {}

  // Reset: edilainesantos.com/demo?reset (ou qualquer página da demo com ?reset)
  if (parametros.has("reset")) {
    lsDemo.clear(); ssDemo.clear();
  }

  // ---------------------------------------------------------------------------
  // 2. Identidade fictícia
  // ---------------------------------------------------------------------------
  const PERFIL = {
    nome: "Bia Valença", nomeCurto: "Bia", usuario: "seu.nome", arroba: "@biavalenca.ugc",
    email: "contato@biavalenca.com.br", site: "biavalenca.com.br",
    colaborador: "example70", colaboradorCompleto: "example70"
  };

  // Ordem importa (do mais específico pro mais genérico)
  const TROCAS_DE_TEXTO = [
    [/edilainesantosugc@gmail\.com/gi, PERFIL.email],
    [/gustavoamoreira@portal\.edilainesantos\.com/gi, "colaborador@portal.biavalenca.com.br"],
    [/(https?:\/\/)?(www\.)?edilainesantos\.com/gi, PERFIL.site],
    [/@?byedisantos/gi, PERFIL.arroba],
    [/edi\.santos/gi, PERFIL.usuario],
    [/Edilaine Santos/g, PERFIL.nome],
    [/EDILAINE SANTOS/g, PERFIL.nome.toUpperCase()],
    [/EDILAINE/g, "BIA"],
    [/Oiee Edi!!/g, "Oiee (SEU NOME AQUI)!!"],   // pedido dela: saudação da demo sem nome
    [/Edilaine/g, PERFIL.nomeCurto],
    [/(?<![\wÀ-ÿ])Diih(?![\wÀ-ÿ])/g, PERFIL.nomeCurto],
    [/(?<![\wÀ-ÿ])Edi(?![\wÀ-ÿ])/g, PERFIL.nomeCurto],
    [/Gustavo Moreira|Gustavo A\. Moreira/g, PERFIL.colaboradorCompleto],
    [/Gustavo/g, PERFIL.colaborador],
    [/GUSTAVO/g, PERFIL.colaborador.toUpperCase()],
    [/Pensão Lívia|PENSÃO LÍVIA/g, "Mensalidade"],
    [/Lívia/g, "example71"],
    [/Pensão/g, "Mensalidade"], [/PENSÃO/g, "MENSALIDADE"], [/pensão/g, "mensalidade"],
    [/(?<![\wÀ-ÿ])Edmar(?![\wÀ-ÿ])/g, "example73"], [/(?<![\wÀ-ÿ])EDMAR(?![\wÀ-ÿ])/g, "EX73"],
    [/(?<![\wÀ-ÿ])Fuuh(?![\wÀ-ÿ])/g, "example74"], [/(?<![\wÀ-ÿ])FUUH(?![\wÀ-ÿ])/g, "EX74"],
    [/(?<![\wÀ-ÿ])(Théo|Theo|Bento)(?![\wÀ-ÿ])/g, "example72"],
    [/(?<![\wÀ-ÿ])DI\/GU(?![\wÀ-ÿ])/g, "BI/EX70"],
    [/(?<![\wÀ-ÿ])DI-GU(?![\wÀ-ÿ])/g, "BI-EX70"],
    [/(?<![\wÀ-ÿ])DI(?![\wÀ-ÿ])/g, "BI"],
    [/(?<![\wÀ-ÿ])GU(?![\wÀ-ÿ])/g, "EX70"],
    [/(?<![\wÀ-ÿ])Gu(?![\wÀ-ÿ])/g, "example70"],
    [/Hortolândia/g, "Campinas"],
    [/\(?19\)?\s?9\s?9384-?2684/g, "(11) 98765-4321"],
    [/5519993842684/g, "5511987654321"]
  ];
  const TEM_ALGUM_NOMES = /edilaine|edi|diih|byedisantos|gustavo|l[ií]via|pens[aã]o|edmar|fuuh|th[eé]o|bento|hortol|9384|5519993/i;
  const TEM_ALGUM_SIGLAS = /DI|GU|Gu/;
  const TEM_ALGUM = { test: (t) => TEM_ALGUM_NOMES.test(t) || TEM_ALGUM_SIGLAS.test(t) };
  // (só um filtro rápido; a troca de verdade, palavra inteira, é a lista acima)

  function trocarTexto(texto){
    if (!texto || !TEM_ALGUM.test(texto)) return texto;
    let t = texto;
    for (const [re, novo] of TROCAS_DE_TEXTO) t = t.replace(re, novo);
    return t;
  }

  function trocarNoElemento(raiz){
    if (!raiz) return;
    if (raiz.nodeType === 3){
      const p = raiz.parentNode;
      if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE")) return;
      const novo = trocarTexto(raiz.nodeValue);
      if (novo !== raiz.nodeValue) raiz.nodeValue = novo;
      return;
    }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
    if (raiz.nodeName === "SCRIPT" || raiz.nodeName === "STYLE") return;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    const lista = [];
    while ((n = walker.nextNode())) lista.push(n);
    lista.forEach(trocarNoElemento);
    const elementos = raiz.nodeType === 1 ? [raiz, ...raiz.querySelectorAll("[placeholder],[title],[alt],[aria-label],input,textarea,option")] : [...(raiz.querySelectorAll ? raiz.querySelectorAll("[placeholder],[title],[alt],[aria-label],input,textarea,option") : [])];
    elementos.forEach(el => {
      ["placeholder", "title", "alt", "aria-label"].forEach(a => {
        const v = el.getAttribute && el.getAttribute(a);
        if (v){ const nv = trocarTexto(v); if (nv !== v) el.setAttribute(a, nv); }
      });
      if ((el.nodeName === "INPUT" && el.type !== "hidden") || el.nodeName === "TEXTAREA"){
        if (document.activeElement !== el && el.value){ const nv = trocarTexto(el.value); if (nv !== el.value) el.value = nv; }
      }
    });
  }

  // Textos quebrados em vários pedaços no HTML (ex: logo "edi<span>.</span>santos")
  function trocarTextosQuebrados(raiz){
    const base = raiz && raiz.querySelectorAll ? raiz : document;
    base.querySelectorAll(".logo, .marca-logo, h1, h2, .nome").forEach(el => {
      if (el.children.length > 3) return;
      const t = (el.textContent || "").trim();
      if (/^edi\.santos$/i.test(t)) el.innerHTML = 'seu<span class="ponto">.</span>nome';
    });
  }

  function iniciarTrocaDeTexto(){
    trocarNoElemento(document.body);
    trocarTextosQuebrados(document);
    document.title = trocarTexto(document.title);
    const obs = new MutationObserver(lista => {
      for (const m of lista){
        if (m.type === "characterData") trocarNoElemento(m.target);
        else if (m.type === "attributes") trocarNoElemento(m.target);
        else m.addedNodes.forEach(n => { trocarNoElemento(n); if (n.nodeType === 1) trocarTextosQuebrados(n.parentNode || n); });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "alt", "aria-label"] });
    // Campos preenchidos por código (value) não disparam o observador
    setInterval(() => {
      document.querySelectorAll("input:not([type=hidden]), textarea").forEach(el => {
        if (document.activeElement !== el && el.value && TEM_ALGUM.test(el.value)) el.value = trocarTexto(el.value);
      });
      const t = trocarTexto(document.title);
      if (t !== document.title) document.title = t;
    }, 1200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarTrocaDeTexto);
  else iniciarTrocaDeTexto();

  // Fotos e vídeos reais (portfólio/biosite): trocadas por ilustrações; vídeos não abrem
  const PERMITIDAS = /textura|borboleta|\.svg(\?|$)|icone|icon|favicon|apple-touch/i;
  function svgPessoa(){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9DFD4"/><stop offset="1" stop-color="#C9A66B"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><circle cx="300" cy="300" r="120" fill="#000080" opacity=".85"/><path d="M120 800c0-150 80-260 180-260s180 110 180 260z" fill="#000080" opacity=".85"/><text x="300" y="330" font-family="Georgia" font-size="96" fill="#fff" text-anchor="middle">BV</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function svgFoto(seed){
    const cores = [["#000080", "#C9A66B"], ["#C9A66B", "#2D7A4F"], ["#2D7A4F", "#000080"], ["#6B645C", "#C9A66B"], ["#8a6d34", "#000080"]];
    const [c1, c2] = cores[Math.abs(seed) % cores.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  const hash = (t) => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; };
  function trocarImagens(raiz){
    const base = raiz && raiz.querySelectorAll ? raiz : document;
    const imgs = raiz && raiz.nodeName === "IMG" ? [raiz] : [...base.querySelectorAll("img")];
    imgs.forEach(img => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || PERMITIDAS.test(src)){
        if (src && PERMITIDAS.test(src)) img.style.setProperty("visibility", "visible", "important");
        return;
      }
      if (/imagens\/|ytimg\.com|\.(jpe?g|png|webp|gif)(\?|$)/i.test(src)){
        img.setAttribute("src", /hero|perfil|sobre/i.test(src) ? svgPessoa() : svgFoto(hash(src)));
        img.removeAttribute("srcset");
      }
    });
    const comFundo = raiz && raiz.nodeType === 1 && raiz.getAttribute && raiz.getAttribute("style") ? [raiz, ...base.querySelectorAll("[style*='url(']")] : [...base.querySelectorAll("[style*='url(']")];
    comFundo.forEach(el => {
      const st = el.getAttribute("style") || "";
      if (!/url\(/.test(st) || PERMITIDAS.test(st)) return;
      if (/imagens\/|ytimg\.com|\.(jpe?g|png|webp|gif)/i.test(st)){
        el.style.backgroundImage = /sobre|perfil|hero/i.test(st) ? `url("${svgPessoa()}")` : "none";
      }
    });
  }
  document.addEventListener("click", (ev) => {
    const video = ev.target.closest && ev.target.closest("[data-video-id]");
    if (video){ ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  document.addEventListener("DOMContentLoaded", () => {
    trocarImagens(document);
    new MutationObserver(lista => lista.forEach(m => {
      if (m.type === "attributes") trocarImagens(m.target);
      else m.addedNodes.forEach(n => { if (n.nodeType === 1) trocarImagens(n); });
    })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });
  });

  ["alert", "confirm", "prompt"].forEach(nome => {
    const original = window[nome];
    if (typeof original === "function") window[nome] = function(msg, ...resto){ return original.call(window, trocarTexto(String(msg ?? "")), ...resto); };
  });

  // ---------------------------------------------------------------------------
  // 3. Nada sai pra fora
  // ---------------------------------------------------------------------------
  const fetchReal = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(entrada, opcoes){
    let url;
    try { url = new URL(typeof entrada === "string" ? entrada : entrada.url, location.href); } catch (e) { url = null; }
    if (url && url.origin === location.origin && fetchReal) return fetchReal(entrada, opcoes);
    const corpo = respostaExternaSimulada(url);
    return Promise.resolve(new Response(JSON.stringify(corpo), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  function respostaExternaSimulada(url){
    const u = url ? url.href : "";
    if (u.includes("supadata")) return { content: "Transcrição de exemplo: hoje eu vou te mostrar como eu organizo minha rotina de gravação em três passos simples...", lang: "pt" };
    if (u.includes("tiktok.com/oembed")) return { title: "Vídeo de exemplo", thumbnail_url: "" };
    if (u.includes("googleapis.com/calendar")) return { items: [] };
    return {};
  }
  try { if (navigator.sendBeacon) navigator.sendBeacon = () => true; } catch (e) {}
  try {
    if (navigator.serviceWorker){
      const sw = navigator.serviceWorker;
      sw.register = () => Promise.reject(new Error("Notificações desativadas na demonstração."));
      sw.getRegistration = () => Promise.resolve(undefined);
    }
  } catch (e) {}
  const abrirReal = window.open;
  window.open = function(url, ...resto){
    try { const u = new URL(url, location.href); if (u.origin === location.origin) return abrirReal.call(window, url, ...resto); } catch (e) {}
    return { closed: false, close(){}, focus(){}, location: {}, document: { write(){}, close(){} } };
  };
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/^(mailto:|tel:|whatsapp:)/i.test(href)){ ev.preventDefault(); return; }
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin){ ev.preventDefault(); }
    } catch (e) {}
  }, true);
  // Google (agenda): nunca carrega o login real do Google
  const googleFalso = {
    accounts: {
      id: { initialize(){}, prompt(){}, renderButton(){}, disableAutoSelect(){} },
      oauth2: {
        initTokenClient: (cfg) => ({ requestAccessToken(){ setTimeout(() => cfg && cfg.callback && cfg.callback({ access_token: "demo", expires_in: 3600 }), 300); } }),
        revoke(_, cb){ cb && cb(); }
      }
    }
  };
  try { Object.defineProperty(window, "google", { configurable: false, get: () => googleFalso, set(){} }); } catch (e) {}

  // ---------------------------------------------------------------------------
  // 4. Banco de mentira (substitui o Supabase)
  // ---------------------------------------------------------------------------
  const CHAVE_BANCO = "banco";
  const VERSAO_DADOS = "4";
  const hojeISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  let banco = null;

  function uuid(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });
  }

  function carregarBanco(){
    if (banco) return banco;
    try {
      const salvo = JSON.parse(lsDemo.getItem(CHAVE_BANCO) || "null");
      // Dados sempre "de hoje": a cada dia novo, gera de novo (follow ups, mês atual etc. sempre com conteúdo)
      if (salvo && salvo.dia === hojeISO && salvo.versao === VERSAO_DADOS){ banco = salvo; return banco; }
    } catch (e) {}
    const gerar = window.EDI_DEMO_GERAR_DADOS;
    banco = { dia: hojeISO, versao: VERSAO_DADOS, tabelas: gerar ? gerar({ uuid, PERFIL }) : {} };
    salvarBanco();
    return banco;
  }
  let salvarAgendado = null;
  function salvarBanco(){
    clearTimeout(salvarAgendado);
    salvarAgendado = setTimeout(() => { try { lsDemo.setItem(CHAVE_BANCO, JSON.stringify(banco)); } catch (e) {} }, 300);
  }
  function tabela(nome){
    const b = carregarBanco();
    if (!b.tabelas[nome]) b.tabelas[nome] = [];
    return b.tabelas[nome];
  }

  const PADROES_TABELA = {
    painel_abordagens: { arquivado: false, followup_feito: false, arquivado_automaticamente: false },
    painel_marcas: { prioridade: false, selecionada: false, status: "a_enviar" },
    financas_lancamentos: { conferido: false },
    painel_ugc_trabalhos: { roteiro_aprovado: false, edicao_aprovada: false, contrato_ativo: false, briefing_arquivos: [] },
    painel_tarefas: { concluida: false },
    portfolio_leads: { lida: false },
    painel_briefing_respostas: { lida: false },
    painel_roteiros_respostas: { lida: false },
    painel_iara_sessoes: { favorito: false, status: "andamento" },
    painel_notas: { fechada: false, utilizada: false },
    painel_mantras: { fechada: false },
    negocio_lancamentos: { recebido: true }
  };

  function comPadroes(nomeTabela, linha){
    const agora = new Date().toISOString();
    const base = { ...(PADROES_TABELA[nomeTabela] || {}) };
    const nova = { ...base, ...linha };
    if (nova.id === undefined && !["financas_contas_fixas_ocultas", "painel_lembretes_snooze", "painel_checklist_observacoes", "painel_checklist_semanal", "app_config", "portal_gustavo_pensao", "financas_meses_fechados"].includes(nomeTabela)) nova.id = uuid();
    if (nova.created_at === undefined) nova.created_at = agora;
    return nova;
  }

  function comparar(a, b){
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  }
  const igual = (a, b) => a === b || (a !== null && b !== null && a !== undefined && b !== undefined && String(a) === String(b));

  class Consulta {
    constructor(nomeTabela){
      this.t = nomeTabela; this.op = "select"; this.filtros = []; this.ordens = []; this.faixa = null; this.limite = null;
      this.modo = null; this.retornar = false; this.valores = null; this.opcoes = {}; this.contar = false; this.soCabecalho = false;
    }
    select(_colunas, opcoes){
      if (this.op === "select") this.op = "select"; else this.retornar = true;
      if (opcoes && opcoes.count) this.contar = true;
      if (opcoes && opcoes.head) this.soCabecalho = true;
      return this;
    }
    insert(valores){ this.op = "insert"; this.valores = valores; return this; }
    update(valores){ this.op = "update"; this.valores = valores; return this; }
    upsert(valores, opcoes){ this.op = "upsert"; this.valores = valores; this.opcoes = opcoes || {}; return this; }
    delete(){ this.op = "delete"; return this; }
    eq(c, v){ this.filtros.push(l => igual(l[c], v)); return this; }
    neq(c, v){ this.filtros.push(l => !igual(l[c], v)); return this; }
    in(c, lista){ const s = (lista || []).map(String); this.filtros.push(l => s.includes(String(l[c]))); return this; }
    gt(c, v){ this.filtros.push(l => l[c] != null && comparar(l[c], v) > 0); return this; }
    gte(c, v){ this.filtros.push(l => l[c] != null && comparar(l[c], v) >= 0); return this; }
    lt(c, v){ this.filtros.push(l => l[c] != null && comparar(l[c], v) < 0); return this; }
    lte(c, v){ this.filtros.push(l => l[c] != null && comparar(l[c], v) <= 0); return this; }
    is(c, v){ this.filtros.push(l => (v === null ? l[c] == null : l[c] === v)); return this; }
    like(c, p){ return this.ilike(c, p); }
    ilike(c, p){ const re = new RegExp("^" + String(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i"); this.filtros.push(l => re.test(String(l[c] ?? ""))); return this; }
    not(c, op, v){ if (op === "is" && v === null) this.filtros.push(l => l[c] != null); else this.filtros.push(l => !igual(l[c], v)); return this; }
    match(obj){ Object.entries(obj || {}).forEach(([c, v]) => this.eq(c, v)); return this; }
    contains(){ return this; }
    or(){ return this; }
    filter(c, op, v){ if (op === "eq") return this.eq(c, v); return this; }
    order(c, opcoes){ const asc = !opcoes || opcoes.ascending !== false; this.ordens.push([c, asc]); return this; }
    range(a, b){ this.faixa = [a, b]; return this; }
    limit(n){ this.limite = n; return this; }
    single(){ this.modo = "single"; return this; }
    maybeSingle(){ this.modo = "maybe"; return this; }
    abortSignal(){ return this; }
    throwOnError(){ return this; }
    then(ok, falha){
      let resultado;
      try { resultado = this._executar(); } catch (erro) { resultado = { data: null, error: { message: String(erro && erro.message || erro) } }; }
      return Promise.resolve(resultado).then(ok, falha);
    }
    _filtrar(linhas){ return linhas.filter(l => this.filtros.every(f => f(l))); }
    _executar(){
      const linhas = tabela(this.t);
      const copia = (x) => JSON.parse(JSON.stringify(x));
      if (this.op === "select"){
        let r = this._filtrar(linhas);
        for (let i = this.ordens.length - 1; i >= 0; i--){
          const [c, asc] = this.ordens[i];
          r = r.slice().sort((a, b) => (asc ? 1 : -1) * comparar(a[c], b[c]));
        }
        const total = r.length;
        if (this.faixa) r = r.slice(this.faixa[0], this.faixa[1] + 1);
        if (this.limite != null) r = r.slice(0, this.limite);
        if (this.soCabecalho) return { data: null, count: total, error: null };
        return this._formatar(copia(r), total);
      }
      if (this.op === "insert"){
        const novos = (Array.isArray(this.valores) ? this.valores : [this.valores]).map(v => comPadroes(this.t, v));
        linhas.push(...novos);
        salvarBanco();
        return this._formatar(this.retornar ? copia(novos) : null);
      }
      if (this.op === "update"){
        const alvo = this._filtrar(linhas);
        alvo.forEach(l => Object.assign(l, copia(this.valores)));
        salvarBanco();
        return this._formatar(this.retornar ? copia(alvo) : null);
      }
      if (this.op === "upsert"){
        const chaves = String(this.opcoes.onConflict || "id").split(",").map(s => s.trim());
        const saida = [];
        (Array.isArray(this.valores) ? this.valores : [this.valores]).forEach(v => {
          const existente = linhas.find(l => chaves.every(k => v[k] !== undefined && igual(l[k], v[k])));
          if (existente){ Object.assign(existente, copia(v)); saida.push(existente); }
          else { const n = comPadroes(this.t, v); linhas.push(n); saida.push(n); }
        });
        salvarBanco();
        return this._formatar(this.retornar ? copia(saida) : null);
      }
      if (this.op === "delete"){
        const alvo = new Set(this._filtrar(linhas));
        const removidos = linhas.filter(l => alvo.has(l));
        const restantes = linhas.filter(l => !alvo.has(l));
        linhas.length = 0; linhas.push(...restantes);
        salvarBanco();
        return this._formatar(this.retornar ? copia(removidos) : null);
      }
      return { data: null, error: null };
    }
    _formatar(dados, total){
      if (this.modo === "single"){
        if (!dados || dados.length !== 1) return { data: dados && dados[0] ? dados[0] : null, error: dados && dados.length ? null : { message: "Nenhum registro", code: "PGRST116" } };
        return { data: dados[0], error: null };
      }
      if (this.modo === "maybe") return { data: dados && dados.length ? dados[0] : null, error: null };
      return { data: dados, count: this.contar ? (total ?? (dados ? dados.length : 0)) : null, error: null };
    }
  }

  // Funções "na nuvem" (Edge Functions): todas simuladas, nenhuma chamada real
  function funcaoSimulada(nome, opcoes){
    const n = String(nome).split("?")[0];
    const simular = window.EDI_DEMO_FUNCOES && window.EDI_DEMO_FUNCOES[n];
    const corpo = opcoes && opcoes.body;
    const resposta = simular ? simular(corpo, nome, { tabela, uuid, PERFIL }) : { ok: true };
    return new Promise(ok => setTimeout(() => ok({ data: resposta, error: null }), n.startsWith("ia-") ? 900 : 250));
  }

  const arquivosDemo = {};
  function armazenamentoSimulado(balde){
    return {
      upload(caminho, arquivo){
        try { arquivosDemo[`${balde}/${caminho}`] = URL.createObjectURL(arquivo); } catch (e) {}
        return Promise.resolve({ data: { path: caminho }, error: null });
      },
      createSignedUrl(caminho){ return Promise.resolve({ data: { signedUrl: arquivosDemo[`${balde}/${caminho}`] || "about:blank" }, error: null }); },
      getPublicUrl(caminho){ return { data: { publicUrl: arquivosDemo[`${balde}/${caminho}`] || "" } }; },
      remove(){ return Promise.resolve({ data: [], error: null }); },
      download(){ return Promise.resolve({ data: new Blob([""]), error: null }); },
      list(){ return Promise.resolve({ data: [], error: null }); }
    };
  }

  // Portal e painel têm "sair" independentes
  const CHAVE_DESLOGADA = location.pathname.startsWith("/gustavo") ? "deslogada-portal" : "deslogada";
  const USUARIO = { id: "00000000-0000-4000-8000-00000000demo", email: PERFIL.email, user_metadata: { nome: PERFIL.nome } };
  const SESSAO = { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, expires_in: 3600 * 24 * 365, user: USUARIO };

  function criarClienteSimulado(){
    const canal = { on(){ return canal; }, subscribe(cb){ cb && cb("SUBSCRIBED"); return canal; }, unsubscribe(){ return Promise.resolve("ok"); } };
    return {
      from: (t) => new Consulta(t),
      rpc: (nome, args) => {
        const simular = window.EDI_DEMO_RPC && window.EDI_DEMO_RPC[nome];
        return Promise.resolve({ data: simular ? simular(args, { tabela }) : null, error: null });
      },
      functions: { invoke: funcaoSimulada },
      storage: { from: armazenamentoSimulado },
      channel: () => canal,
      removeChannel: () => Promise.resolve("ok"),
      removeAllChannels: () => Promise.resolve([]),
      auth: {
        // "Sair" na demo leva mesmo pra tela de login (pra dar pra gravar o login); entrar com
        // qualquer e-mail/senha volta. Guardado só na área da demo.
        getSession: () => Promise.resolve({ data: { session: lsDemo.getItem(CHAVE_DESLOGADA) ? null : SESSAO }, error: null }),
        getUser: () => Promise.resolve({ data: { user: USUARIO }, error: null }),
        refreshSession: () => Promise.resolve({ data: { session: lsDemo.getItem(CHAVE_DESLOGADA) ? null : SESSAO, user: USUARIO }, error: null }),
        signInWithPassword: () => { lsDemo.removeItem(CHAVE_DESLOGADA); return Promise.resolve({ data: { session: SESSAO, user: USUARIO }, error: null }); },
        signOut: () => { lsDemo.setItem(CHAVE_DESLOGADA, "1"); return Promise.resolve({ error: null }); },
        resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
        updateUser: () => Promise.resolve({ data: { user: USUARIO }, error: null }),
        onAuthStateChange: (cb) => { setTimeout(() => cb && cb("SIGNED_IN", SESSAO), 0); return { data: { subscription: { unsubscribe(){} } } }; },
        startAutoRefresh(){}, stopAutoRefresh(){}
      }
    };
  }

  // O supabase-js do CDN carrega ANTES deste arquivo; troca o "criar cliente" por um
  // que nunca se conecta ao banco real (e nunca lê a sessão real guardada no navegador).
  function trocarSupabase(){
    if (window.supabase && !window.supabase.__demo){
      window.supabase = { ...window.supabase, createClient: () => criarClienteSimulado(), __demo: true };
    }
  }
  trocarSupabase();
  if (!window.supabase){
    let valor;
    try {
      Object.defineProperty(window, "supabase", {
        configurable: true,
        get: () => valor,
        set: (v) => { valor = v ? { ...v, createClient: () => criarClienteSimulado(), __demo: true } : v; }
      });
    } catch (e) {}
  }

  // Diagnóstico (só com ?debug no endereço): lista erros de JavaScript numa caixa
  if (parametros.has("debug")){
    const erros = [];
    window.addEventListener("error", e => erros.push((e.message || "erro") + " @ " + (e.filename || "").split("/").pop() + ":" + e.lineno));
    window.addEventListener("unhandledrejection", e => erros.push("promise: " + (e.reason && (e.reason.message || e.reason))));
    const consoleErro = console.error;
    console.error = function(...a){ erros.push("console: " + a.map(x => (x && x.message) || String(x)).join(" ").slice(0, 200)); return consoleErro.apply(console, a); };
    setTimeout(() => {
      const caixa = document.createElement("pre");
      caixa.id = "demoDebug";
      caixa.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;background:#200;color:#fdd;font:11px monospace;z-index:999999;padding:8px;white-space:pre-wrap;margin:0";
      let sessaoReal = "?";
      try { sessaoReal = localStorage.getItem("sb-dqtoxxngjqyoibdgmrjr-auth-token") ? "VISÍVEL (ERRO!)" : "invisível (ok)"; } catch (e) {}
      let realIntacta = "?";
      try { realIntacta = lsReal && lsReal.getItem("sb-dqtoxxngjqyoibdgmrjr-auth-token") ? "intacta" : "não existe"; } catch (e) {}
      caixa.textContent = (erros.length ? erros.join("\n") : "SEM ERROS") + `\nsessão real dentro da demo: ${sessaoReal} | sessão real guardada: ${realIntacta}`;
      document.body.appendChild(caixa);
    }, Number(parametros.get("debug")) || 6000);
  }

  // Avisos do painel: na demo NÃO aparecem sozinhos ao abrir (atrapalha a apresentação).
  // Ficam guardados num sininho ao lado do olho; ela clica quando quiser mostrar.
  {
    const estiloSino = document.createElement("style");
    estiloSino.textContent = `
      body:not(.demo-ver-avisos) #areaNotificacoesPopup{ display: none !important; }
      .demo-sino{ position: relative; margin-left: auto; margin-right: 8px; }
      .demo-sino svg{ width: 18px; height: 18px; }
      .demo-sino .demo-sino-ponto{ position: absolute; top: 4px; right: 5px; width: 9px; height: 9px; border-radius: 50%; background: #C4453C; border: 2px solid #fff; display: none; }
      .demo-sino.tem-aviso .demo-sino-ponto{ display: block; }
      .sidebar-topo .sidebar-marca + .demo-sino{ margin-left: auto; }
    `;
    (document.head || document.documentElement).appendChild(estiloSino);
    const SVG_SINO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="demo-sino-ponto"></span>';
    document.addEventListener("DOMContentLoaded", () => {
      const area = document.getElementById("areaNotificacoesPopup");
      if (!area) return;
      const sinos = [];
      [document.getElementById("botaoModoOculto"), document.getElementById("botaoModoOcultoMobile")].forEach(olho => {
        if (!olho) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = olho.className + " demo-sino";
        b.title = "Ver notificações";
        b.setAttribute("aria-label", "Ver notificações");
        b.innerHTML = SVG_SINO;
        b.addEventListener("click", () => document.body.classList.add("demo-ver-avisos"));
        olho.parentNode.insertBefore(b, olho);
        sinos.push(b);
      });
      const atualizar = () => {
        const tem = area.children.length > 0;
        sinos.forEach(b => b.classList.toggle("tem-aviso", tem));
        if (!tem) document.body.classList.remove("demo-ver-avisos");
      };
      new MutationObserver(atualizar).observe(area, { childList: true });
      // Depois de responder um aviso, o próximo fica guardado no sininho (não pula na tela)
      area.addEventListener("click", (ev) => {
        if (ev.target.closest("button")) setTimeout(() => document.body.classList.remove("demo-ver-avisos"), 0);
      });
      atualizar();
    });
  }

  // Testes: ?aba=financas (abre direto uma aba do painel) e ?clicar=seletor (clica em algo)
  if (parametros.get("aba") || parametros.get("clicar")){
    setTimeout(() => {
      const aba = parametros.get("aba");
      if (aba){ const b = document.querySelector(`.menu-item[data-tab="${aba}"]`); if (b) b.click(); }
      const sub = parametros.get("sub");
      if (sub) setTimeout(() => { const s = document.querySelector(`.sub-aba-btn[data-subaba="${sub}"]:not(.oculto)`) || [...document.querySelectorAll(`[data-subaba="${sub}"]`)].find(e => e.offsetParent); if (s) s.click(); }, 400);
      const clicar = parametros.get("clicar");
      if (clicar) setTimeout(() => { const el = document.querySelector(clicar); if (el) el.click(); }, 900);
    }, 2500);
  }

  window.EDI_DEMO = {
    ativo: true,
    PERFIL,
    trocarTexto,
    tabela,
    resetar(){ lsDemo.clear(); ssDemo.clear(); location.reload(); }
  };
})();
