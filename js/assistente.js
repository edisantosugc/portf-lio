/* =========================================================================
   ABA "ASSISTENTE" (Pendências, Compras e indicações, Lembretes, Passagem)
   Tudo desta aba mora aqui, separado do resto do painel.
   - Tabelas: assistente_pendencias / assistente_indicacoes / assistente_lembretes /
     assistente_passagens (ver assistente_setup.sql). Só a dona tem acesso (RLS).
   - Não existe apagar: nem aqui, nem no banco. Pra tirar da lista, muda o status.
   - O nome da aba fica só no menu do painel.html (span#menuNomeAssistente).
   ========================================================================= */
(function(){
  const CATEGORIAS = ["Roteiros", "Edição", "Estudos", "Projetos", "Pessoal", "Mudança", "Outros"];
  const PRIORIDADES = {
    1: "Traz dinheiro",
    2: "Destrava postagens",
    3: "Conteúdo novo",
    4: "Pessoal / sem prioridade"
  };
  const PRIORIDADES_CURTAS = { 1: "Dinheiro", 2: "Destrava posts", 3: "Conteúdo novo", 4: "Pessoal" };
  const STATUS_PENDENCIA = ["Pendente", "Em andamento", "Feito", "Descartado"];
  const STATUS_ESCONDIDOS = ["Feito", "Descartado"];
  // Matriz de Eisenhower (ordem = ordem na tela: verde, laranja, azul, vermelho)
  const QUADRANTES = [
    { nome: "Faça na hora",           titulo: "IMPORTANTE E URGENTE",         frase: "Faça na hora!",                  classe: "q1" },
    { nome: "Programe-se",            titulo: "IMPORTANTE MAS NÃO URGENTE",   frase: "Programe-se",                    classe: "q2" },
    { nome: "Delegue",                titulo: "URGENTE MAS NÃO IMPORTANTE",   frase: "Delegue",                        classe: "q3" },
    { nome: "Tempo livre ou elimine", titulo: "NÃO URGENTE E NÃO IMPORTANTE", frase: "Faça no tempo livre ou elimine", classe: "q4" }
  ];
  // Cores da matriz (a Edi pode trocar pelo botão "Cores"; fica salvo em assistente_config)
  const CORES_ORIGINAIS = { q1: "#B5E61D", q2: "#FF9F1C", q3: "#7FD0F5", q4: "#EF4135" };
  const INTENSIDADE_MIN = 15, INTENSIDADE_PADRAO = 100;
  const CHAVE_CORES = "cores_matriz";
  const STATUS_INDICACAO = ["Quero comprar", "Comprado", "Desisti"];
  const STATUS_LEMBRETE = ["Pendente", "Feito"];

  const estado = {
    carregado: false,
    carregando: false,
    subaba: "pendencias",
    pendencias: [],
    indicacoes: [],
    lembretes: [],
    passagens: [],
    filtroCategoria: "",
    filtroStatus: "",
    mostrarFeitosPendencias: false,
    mostrarFeitosLembretes: false,
    abertos: new Set(),        // descrições/detalhes abertos (por id)
    gruposAbertos: new Set(),  // grupos de "quem indicou" abertos
    quadAbertos: new Set(["Faça na hora"]), // sanfona do celular: só o verde começa aberto
    cores: Object.assign({ intensidade: INTENSIDADE_PADRAO }, CORES_ORIGINAIS),
    painelCoresAberto: false,
    coresSalvas: "",          // "Salvo ✓" / "Salvando…" / erro
    modal: null               // { tipo, id }
  };

  const $ = (id) => document.getElementById(id);

  function esc(t){
    return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function hojeISO(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // "2026-11-14" -> "14/11/2026" (sem passar por Date, pra não mudar de dia por fuso)
  function dataBR(iso){
    if (!iso) return "";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }

  function dataHoraBR(iso){
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function diasAte(iso){
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    const alvo = new Date(a, m - 1, d);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((alvo - hoje) / 86400000);
  }

  function rotuloPrazo(iso){
    const dias = diasAte(iso);
    if (dias === null) return "";
    if (dias < 0) return `atrasado (${dataBR(iso)})`;
    if (dias === 0) return "hoje";
    if (dias === 1) return "amanhã";
    return dataBR(iso);
  }

  function linkSeguro(url){
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(u)) return "https://" + u;
    return "";
  }

  async function buscar(tabela){
    const { data, error } = await Auth.client.from(tabela).select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function carregar(forcar){
    if (estado.carregando) return;
    if (estado.carregado && !forcar){ renderizar(); return; }
    estado.carregando = true;
    $("assistenteConteudo").innerHTML = `<p class="assist-vazio">Carregando…</p>`;
    try {
      const [p, i, l, ps] = await Promise.all([
        buscar("assistente_pendencias"),
        buscar("assistente_indicacoes"),
        buscar("assistente_lembretes"),
        buscar("assistente_passagens")
      ]);
      estado.pendencias = p; estado.indicacoes = i; estado.lembretes = l; estado.passagens = ps;
      await carregarCores();
      estado.carregado = true;
      renderizar();
    } catch (erro) {
      console.error("Assistente: erro ao carregar", erro);
      $("assistenteConteudo").innerHTML = `<p class="assist-vazio">Não deu pra carregar agora. <button type="button" class="btn-fantasma" id="assistTentarDeNovo">Tentar de novo</button></p>`;
      $("assistTentarDeNovo").addEventListener("click", () => carregar(true));
    } finally {
      estado.carregando = false;
    }
  }

  /* ---------------------------- Cores da matriz ---------------------------- */
  const HEX = /^#[0-9a-f]{6}$/i;

  function hexParaRgb(hex){
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Intensidade 100 = cor escolhida; quanto menor, mais "apagadinha" (misturada com branco)
  function corFinal(hex, intensidade){
    const t = intensidade / 100;
    return hexParaRgb(hex).map(c => Math.round(255 + (c - 255) * t));
  }

  function luminancia([r, g, b]){
    const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  }

  // Escolhe preto ou branco pro texto, o que tiver mais contraste com o fundo
  function corDoTexto(rgb){
    const L = luminancia(rgb);
    const contrastePreto = (L + 0.05) / (0.0056 + 0.05);   // #111
    const contrasteBranco = 1.05 / (L + 0.05);
    return contrasteBranco > contrastePreto ? "#FFFFFF" : "#111111";
  }

  function aplicarCores(){
    const alvo = $("assistenteConteudo");
    if (!alvo) return;
    ["q1", "q2", "q3", "q4"].forEach(q => {
      const rgb = corFinal(estado.cores[q], estado.cores.intensidade);
      alvo.style.setProperty(`--assist-${q}-fundo`, `rgb(${rgb.join(",")})`);
      alvo.style.setProperty(`--assist-${q}-texto`, corDoTexto(rgb));
    });
  }

  function coresValidas(v){
    const ok = v && typeof v === "object" && ["q1", "q2", "q3", "q4"].every(q => HEX.test(v[q] || ""));
    const i = Number(v && v.intensidade);
    return ok && i >= INTENSIDADE_MIN && i <= 100;
  }

  async function carregarCores(){
    try {
      const { data, error } = await Auth.client.from("assistente_config").select("valor").eq("chave", CHAVE_CORES).maybeSingle();
      if (!error && data && coresValidas(data.valor)){
        estado.cores = { q1: data.valor.q1, q2: data.valor.q2, q3: data.valor.q3, q4: data.valor.q4, intensidade: Number(data.valor.intensidade) };
      }
    } catch (e) { /* sem preferência salva: fica com as cores originais */ }
    aplicarCores();
  }

  let temporizadorCores = null;
  function salvarCoresDepois(){
    clearTimeout(temporizadorCores);
    mostrarStatusCores("Salvando…");
    temporizadorCores = setTimeout(async () => {
      const valor = Object.assign({}, estado.cores);
      const { error } = await Auth.client.from("assistente_config").upsert({ chave: CHAVE_CORES, valor }, { onConflict: "chave" });
      if (error){ console.error("Assistente: erro ao salvar cores", error); mostrarStatusCores("Não deu pra salvar. Tenta de novo."); }
      else mostrarStatusCores("Salvo ✓");
    }, 600);
  }

  function mostrarStatusCores(texto){
    estado.coresSalvas = texto;
    const el = $("assistCoresStatus");
    if (el) el.textContent = texto;
  }

  function htmlPainelCores(){
    const linha = (q, nome) => `
      <label class="assist-cores-linha">
        <input type="color" value="${estado.cores[q]}" data-acao="assist-cor" data-q="${q}">
        <span>${esc(nome)}</span>
      </label>`;
    return `
      <div class="assist-cores-painel">
        <div class="assist-cores-grade">
          ${linha("q1", "Faça na hora (verde)")}
          ${linha("q2", "Programe-se (laranja)")}
          ${linha("q3", "Delegue (azul)")}
          ${linha("q4", "Tempo livre ou elimine (vermelho)")}
        </div>
        <label class="assist-cores-intensidade">
          <span>Intensidade (vale pros 4)</span>
          <span class="assist-cores-slider"><small>apagadinho</small>
            <input type="range" min="${INTENSIDADE_MIN}" max="100" step="1" value="${estado.cores.intensidade}" data-acao="assist-intensidade">
          <small>forte</small></span>
        </label>
        <div class="assist-cores-botoes">
          <span class="assist-sub" id="assistCoresStatus">${esc(estado.coresSalvas)}</span>
          <button type="button" class="btn-fantasma" data-acao="assist-cores-original">Voltar às cores originais</button>
          <button type="button" class="botao-add-tarefa" data-acao="assist-cores-alternar">Fechar</button>
        </div>
      </div>`;
  }

  /* ---------------------------- Renderização ---------------------------- */

  function renderizar(){
    document.querySelectorAll("#assistenteSubAbas .sub-aba-btn").forEach(b => {
      b.classList.toggle("ativo", b.dataset.subabaAssist === estado.subaba);
    });
    const alvo = $("assistenteConteudo");
    if (estado.subaba === "pendencias") alvo.innerHTML = htmlPendencias();
    else if (estado.subaba === "indicacoes") alvo.innerHTML = htmlIndicacoes();
    else if (estado.subaba === "lembretes") alvo.innerHTML = htmlLembretes();
    else alvo.innerHTML = htmlPassagem();
    if (estado.subaba === "passagem") ligarPassagem();
  }

  function opcoes(lista, atual){
    return lista.map(v => `<option value="${esc(v)}"${v === atual ? " selected" : ""}>${esc(v)}</option>`).join("");
  }

  function blocoTextoLongo(id, texto, rotulo){
    if (!texto) return "";
    const aberto = estado.abertos.has(id);
    return `
      <button type="button" class="assist-ver-mais" data-acao="assist-alternar" data-id="${id}">${aberto ? "▾ esconder " + rotulo : "▸ ver " + rotulo}</button>
      ${aberto ? `<div class="assist-texto-longo">${esc(texto)}</div>` : ""}
    `;
  }

  // ---------- Pendências (Matriz de Eisenhower) ----------
  // Data usada pra ordenar: a mais próxima entre data limite e data agendada
  function dataMaisProxima(p){
    const datas = [p.data_limite, p.data_agendada].filter(Boolean).sort();
    return datas[0] || "9999-12-31";
  }

  function pendenciasVisiveis(){
    let lista = estado.pendencias.slice();
    if (estado.filtroCategoria) lista = lista.filter(p => p.categoria === estado.filtroCategoria);
    if (estado.filtroStatus) lista = lista.filter(p => p.status === estado.filtroStatus);
    else if (!estado.mostrarFeitosPendencias) lista = lista.filter(p => !STATUS_ESCONDIDOS.includes(p.status));
    return lista.sort((a, b) =>
      (a.prioridade - b.prioridade) ||
      dataMaisProxima(a).localeCompare(dataMaisProxima(b)) ||
      String(b.created_at).localeCompare(String(a.created_at))
    );
  }

  function htmlPendencias(){
    const lista = pendenciasVisiveis();
    const nomesQuadrantes = QUADRANTES.map(q => q.nome);
    const semQuadrante = lista.filter(p => !nomesQuadrantes.includes(p.quadrante));
    const qtdEscondidos = estado.pendencias.filter(p => STATUS_ESCONDIDOS.includes(p.status)).length;

    const quadrante = (q) => {
      const itens = lista.filter(p => p.quadrante === q.nome);
      const aberto = estado.quadAbertos.has(q.nome);
      return `
        <section class="assist-quad ${q.classe}${aberto ? " aberto" : ""}" data-soltar-quadrante="${esc(q.nome)}">
          <button type="button" class="assist-quad-cabecalho" data-acao="assist-quad-alternar" data-quadrante="${esc(q.nome)}" aria-expanded="${aberto}">
            <span class="assist-quad-titulo">${esc(q.titulo)} <span class="assist-quad-contagem">${itens.length}</span></span>
            <span class="assist-quad-frase">${esc(q.frase)}</span>
            <span class="assist-quad-seta" aria-hidden="true">▾</span>
          </button>
          <div class="assist-quad-corpo">
            ${itens.length ? itens.map(cardPendencia).join("") : `<p class="assist-quad-vazio">Nenhuma pendência aqui.</p>`}
          </div>
        </section>
      `;
    };

    return `
      <button type="button" class="ugc-linha-add" data-acao="assist-novo" data-tipo="pendencia">+ Nova pendência</button>
      <div class="assist-filtros">
        <label>Categoria
          <select data-acao="assist-filtro-categoria">
            <option value="">Todas</option>${opcoes(CATEGORIAS, estado.filtroCategoria)}
          </select>
        </label>
        <label>Status
          <select data-acao="assist-filtro-status">
            <option value="">Pendente + Em andamento</option>${opcoes(STATUS_PENDENCIA, estado.filtroStatus)}
          </select>
        </label>
        ${estado.filtroStatus ? "" : `
          <label class="assist-check"><input type="checkbox" data-acao="assist-mostrar-feitos" data-lista="pendencias"${estado.mostrarFeitosPendencias ? " checked" : ""}> Mostrar feitos e descartados (${qtdEscondidos})</label>`}
        <button type="button" class="assist-botao-cores" data-acao="assist-cores-alternar" aria-expanded="${estado.painelCoresAberto}" title="Mudar as cores da matriz">🎨 Cores</button>
      </div>
      ${estado.painelCoresAberto ? htmlPainelCores() : ""}

      ${semQuadrante.length ? `
        <section class="assist-sem-quadrante" data-soltar-quadrante="">
          <div class="assist-sem-quadrante-topo">
            <strong>SEM QUADRANTE <span class="assist-quad-contagem">${semQuadrante.length}</span></strong>
            <span class="assist-sub">Arraste pra um quadrante ou abra a linha pra escolher.</span>
          </div>
          <div class="assist-sem-quadrante-lista">${semQuadrante.map(cardPendencia).join("")}</div>
        </section>` : ""}

      <div class="assist-matriz">
        <div class="assist-matriz-canto"></div>
        <div class="assist-matriz-coluna">URGENTE</div>
        <div class="assist-matriz-coluna">NÃO URGENTE</div>
        <div class="assist-matriz-linha"><span>IMPORTANTE</span></div>
        ${quadrante(QUADRANTES[0])}
        ${quadrante(QUADRANTES[1])}
        <div class="assist-matriz-linha"><span>NÃO IMPORTANTE</span></div>
        ${quadrante(QUADRANTES[2])}
        ${quadrante(QUADRANTES[3])}
      </div>
    `;
  }

  function dataCurta(iso){
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return Number(a) === new Date().getFullYear() ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`;
  }

  // Linha fina (modelo "agenda"): barrinha da prioridade, título numa linha só e, no fim,
  // só 📅 com a data mais próxima e ◐ se estiver em andamento. Clicar abre o card.
  function cardPendencia(p){
    const escondido = STATUS_ESCONDIDOS.includes(p.status);
    const datas = [p.data_limite, p.data_agendada].filter(Boolean).sort();
    const atrasado = p.data_limite && !escondido && diasAte(p.data_limite) < 0;
    const dataTitulo = datas.length ? (datas[0] === p.data_limite ? "Data limite" : "Data agendada") : "";
    return `
      <button type="button" class="assist-linha${escondido ? " feito" : ""}" draggable="true" data-arrastar-id="${p.id}"
        data-acao="assist-pend-abrir" data-id="${p.id}" title="${esc(p.titulo)} — prioridade ${p.prioridade}: ${esc(PRIORIDADES[p.prioridade])}">
        <span class="assist-linha-prio prio-${p.prioridade}" aria-hidden="true"></span>
        <span class="assist-linha-titulo">${esc(p.titulo)}</span>
        <span class="assist-linha-icones">
          ${datas.length ? `<span class="${atrasado ? "atrasado" : ""}" title="${dataTitulo}${atrasado ? " (passou)" : ""}">📅 ${esc(dataCurta(datas[0]))}</span>` : ""}
          ${p.status === "Em andamento" ? `<span title="Em andamento">◐</span>` : ""}
          ${p.status === "Feito" ? `<span title="Feito">✓</span>` : ""}
          ${p.status === "Descartado" ? `<span title="Descartado">✕</span>` : ""}
        </span>
      </button>
    `;
  }

  /* ---------------- Card da pendência (abre de lado; no celular, sobe de baixo) ---------------- */
  function abrirCardPendencia(id){
    const p = id ? estado.pendencias.find(x => x.id === id) : null;
    if (id && !p) return;
    estado.cardPend = { id: p ? p.id : null };
    const v = p || { titulo: "", descricao: "", quadrante: "", status: "Pendente", prioridade: 4, categoria: "Outros", data_limite: "", data_agendada: "" };
    const quadSel = `<option value=""${v.quadrante ? "" : " selected"}>Sem quadrante</option>` +
      QUADRANTES.map(q => `<option value="${esc(q.nome)}"${q.nome === v.quadrante ? " selected" : ""}>${esc(q.nome)} — ${esc(q.titulo.toLowerCase())}</option>`).join("");
    const caixa = $("assistPendCard");
    caixa.innerHTML = `
      <aside class="assist-gaveta" role="dialog" aria-modal="true" aria-labelledby="assistPendTitulo">
        <div class="assist-gaveta-topo">
          <div>
            <div class="assist-gaveta-sobre">${p ? esc(p.quadrante || "Sem quadrante") : "Nova pendência"}</div>
            <div class="assist-gaveta-titulo" id="assistPendTitulo">${p ? esc(p.titulo) : "Nova pendência"}</div>
          </div>
          <button type="button" class="assist-gaveta-x" data-pend="fechar" aria-label="Fechar">×</button>
        </div>
        <div class="assist-gaveta-corpo">
          <label class="assist-gcampo largo">Título<input type="text" id="assistPendTituloCampo" value="${esc(v.titulo)}" maxlength="300"></label>
          <label class="assist-gcampo largo">Descrição<textarea id="assistPendDescricao" rows="7">${esc(v.descricao || "")}</textarea></label>
          <label class="assist-gcampo">Quadrante<select id="assistPendQuadrante">${quadSel}</select></label>
          <label class="assist-gcampo">Status<select id="assistPendStatus">${opcoes(STATUS_PENDENCIA, v.status)}</select></label>
          <label class="assist-gcampo">Prioridade<select id="assistPendPrioridade">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === Number(v.prioridade) ? " selected" : ""}>${n} · ${esc(PRIORIDADES[n])}</option>`).join("")}</select></label>
          <label class="assist-gcampo">Categoria<select id="assistPendCategoria">${opcoes(CATEGORIAS, v.categoria)}</select></label>
          <label class="assist-gcampo">Data limite<input type="date" id="assistPendLimite" value="${esc(v.data_limite || "")}"></label>
          <label class="assist-gcampo">Data agendada<input type="date" id="assistPendAgendada" value="${esc(v.data_agendada || "")}"></label>
        </div>
        <div class="assist-gaveta-rodape">
          ${p && p.status !== "Descartado" ? `<button type="button" class="btn-fantasma perigo" data-pend="descartar">Descartar</button>` : "<span></span>"}
          <span class="assist-gaveta-acoes">
            <button type="button" class="btn-fantasma" data-pend="fechar">Fechar</button>
            <button type="button" class="botao-add-tarefa" data-pend="salvar">Salvar</button>
          </span>
        </div>
      </aside>`;
    caixa.classList.remove("oculto");
    document.body.classList.add("assist-gaveta-aberta");
    setTimeout(() => { const t = $("assistPendTituloCampo"); if (t && !p) t.focus(); }, 30);
  }

  function fecharCardPendencia(){
    const caixa = $("assistPendCard");
    if (!caixa || caixa.classList.contains("oculto")) return;
    caixa.classList.add("oculto");
    caixa.innerHTML = "";
    document.body.classList.remove("assist-gaveta-aberta");
    estado.cardPend = null;
  }

  async function salvarCardPendencia(botao, extra){
    const c = estado.cardPend;
    if (!c) return;
    const titulo = $("assistPendTituloCampo").value.trim();
    if (!titulo){ alert("Escreve o título da pendência."); $("assistPendTituloCampo").focus(); return; }
    const dados = Object.assign({
      titulo,
      descricao: $("assistPendDescricao").value.trim() === "" ? null : $("assistPendDescricao").value,
      quadrante: $("assistPendQuadrante").value || null,
      status: $("assistPendStatus").value,
      prioridade: Number($("assistPendPrioridade").value),
      categoria: $("assistPendCategoria").value,
      data_limite: $("assistPendLimite").value || null,
      data_agendada: $("assistPendAgendada").value || null
    }, extra || {});
    if (botao){ botao.disabled = true; botao.textContent = "Salvando…"; }
    const resp = c.id
      ? await Auth.client.from("assistente_pendencias").update(dados).eq("id", c.id).select()
      : await Auth.client.from("assistente_pendencias").insert(dados).select();
    if (resp.error || !resp.data || !resp.data.length){
      console.error("Assistente: erro ao salvar pendência", resp.error);
      alert("Não deu pra salvar agora. Tenta de novo — nada foi perdido.");
      if (botao){ botao.disabled = false; botao.textContent = "Salvar"; }
      return;
    }
    const salvo = resp.data[0];
    const i = estado.pendencias.findIndex(x => x.id === salvo.id);
    if (i >= 0) estado.pendencias[i] = salvo; else estado.pendencias.unshift(salvo);
    fecharCardPendencia();
    renderizar();
  }

  // ---------- Compras e indicações ----------
  function htmlIndicacoes(){
    const grupos = new Map();
    estado.indicacoes.forEach(i => {
      const quem = (i.quem_indicou || "").trim() || "Sem indicação";
      if (!grupos.has(quem)) grupos.set(quem, []);
      grupos.get(quem).push(i);
    });
    const nomes = [...grupos.keys()].sort((a, b) => {
      if (a === "Sem indicação") return 1;
      if (b === "Sem indicação") return -1;
      return a.localeCompare(b, "pt-BR");
    });
    const ordemStatus = { "Quero comprar": 0, "Comprado": 1, "Desisti": 2 };

    return `
      <button type="button" class="ugc-linha-add" data-acao="assist-novo" data-tipo="indicacao">+ Nova indicação</button>
      ${nomes.length ? nomes.map(nome => {
        const itens = grupos.get(nome).sort((a, b) => (ordemStatus[a.status] - ordemStatus[b.status]) || String(b.created_at).localeCompare(String(a.created_at)));
        const querComprar = itens.filter(i => i.status === "Quero comprar").length;
        return `
          <details class="cartao cartao-colapsavel assist-grupo" data-grupo="${esc(nome)}"${estado.gruposAbertos.has(nome) ? " open" : ""}>
            <summary class="resumo-colapsavel">
              <h2>${esc(nome)} <span class="assist-contagem">${itens.length} ${itens.length === 1 ? "item" : "itens"}${querComprar ? ` · ${querComprar} pra comprar` : ""}</span></h2>
              <span class="seta-colapsavel">▾</span>
            </summary>
            <div class="assist-lista">${itens.map(cardIndicacao).join("")}</div>
          </details>
        `;
      }).join("") : `<p class="assist-vazio">Nenhuma indicação ainda.</p>`}
    `;
  }

  function cardIndicacao(i){
    const link = linkSeguro(i.link);
    return `
      <div class="assist-card${i.status !== "Quero comprar" ? " feito" : ""}">
        <div class="assist-card-titulo">${esc(i.produto)}</div>
        ${i.marca_modelo ? `<div class="assist-sub">${esc(i.marca_modelo)}</div>` : ""}
        ${link ? `<a class="assist-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">🔗 abrir link</a>` : ""}
        ${blocoTextoLongo(i.id, i.detalhes, "detalhes")}
        <div class="assist-card-rodape">
          <select class="assist-status" data-acao="assist-status" data-tabela="assistente_indicacoes" data-id="${i.id}" aria-label="Status">${opcoes(STATUS_INDICACAO, i.status)}</select>
          <button type="button" class="marcas-botao-icone" data-acao="assist-editar" data-tipo="indicacao" data-id="${i.id}" title="Editar">✎</button>
        </div>
      </div>
    `;
  }

  // ---------- Lembretes ----------
  function htmlLembretes(){
    const pendentes = estado.lembretes.filter(l => l.status !== "Feito")
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const feitos = estado.lembretes.filter(l => l.status === "Feito")
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return `
      <button type="button" class="ugc-linha-add" data-acao="assist-novo" data-tipo="lembrete">+ Novo lembrete</button>
      <div class="assist-filtros">
        <label class="assist-check"><input type="checkbox" data-acao="assist-mostrar-feitos" data-lista="lembretes"${estado.mostrarFeitosLembretes ? " checked" : ""}> Mostrar feitos (${feitos.length})</label>
      </div>
      <div class="assist-lista">
        ${pendentes.length ? pendentes.map(cardLembrete).join("") : `<p class="assist-vazio">Nenhum lembrete pendente.</p>`}
        ${estado.mostrarFeitosLembretes ? feitos.map(cardLembrete).join("") : ""}
      </div>
    `;
  }

  function cardLembrete(l){
    const dias = diasAte(l.data);
    const atrasado = l.status !== "Feito" && dias < 0;
    return `
      <div class="assist-card assist-card-lembrete${l.status === "Feito" ? " feito" : ""}">
        <span class="assist-prazo${atrasado ? " atrasado" : ""}">📅 ${esc(rotuloPrazo(l.data))}</span>
        <div class="assist-card-titulo">${esc(l.texto)}</div>
        <div class="assist-card-rodape">
          <select class="assist-status" data-acao="assist-status" data-tabela="assistente_lembretes" data-id="${l.id}" aria-label="Status">${opcoes(STATUS_LEMBRETE, l.status)}</select>
          <button type="button" class="marcas-botao-icone" data-acao="assist-editar" data-tipo="lembrete" data-id="${l.id}" title="Editar">✎</button>
        </div>
      </div>
    `;
  }

  // ---------- Passagem ----------
  function htmlPassagem(){
    const atual = estado.passagens.find(p => p.atual);
    const historico = estado.passagens.filter(p => !p.atual)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return `
      <div class="cartao assist-passagem">
        <div class="assist-passagem-topo">
          <h2>Passagem atual</h2>
          <span class="assist-sub">${atual ? "Salva em " + esc(dataHoraBR(atual.created_at)) : "Ainda não tem passagem salva"}</span>
        </div>
        <textarea id="assistPassagemTexto" class="assist-passagem-texto" placeholder="Cole ou escreva aqui o prompt de passagem…">${esc(atual ? atual.texto : "")}</textarea>
        <div class="assist-passagem-botoes">
          <button type="button" class="btn-fantasma" id="assistPassagemCopiar"${atual ? "" : " disabled"}>Copiar</button>
          <button type="button" class="botao-add-tarefa" id="assistPassagemSalvar" disabled>Salvar nova versão</button>
        </div>
        <p class="assist-dica">Ao salvar, a versão de agora vai sozinha pro histórico.</p>
      </div>
      <details class="cartao cartao-colapsavel assist-historico">
        <summary class="resumo-colapsavel">
          <h2>Histórico <span class="assist-contagem">${historico.length} ${historico.length === 1 ? "versão" : "versões"}</span></h2>
          <span class="seta-colapsavel">▾</span>
        </summary>
        ${historico.length ? historico.map(h => `
          <details class="assist-versao">
            <summary>${esc(dataHoraBR(h.created_at))} <span class="assist-sub">${esc(h.texto.split("\n")[0].slice(0, 80))}</span></summary>
            <div class="assist-texto-longo">${esc(h.texto)}</div>
          </details>
        `).join("") : `<p class="assist-vazio">Nenhuma versão antiga ainda.</p>`}
      </details>
    `;
  }

  function ligarPassagem(){
    const atual = estado.passagens.find(p => p.atual);
    const campo = $("assistPassagemTexto");
    const salvar = $("assistPassagemSalvar");
    const textoOriginal = atual ? atual.texto : "";
    campo.addEventListener("input", () => {
      salvar.disabled = !campo.value.trim() || campo.value === textoOriginal;
    });
    salvar.addEventListener("click", async () => {
      salvar.disabled = true;
      salvar.textContent = "Salvando…";
      const { error } = await Auth.client.rpc("assistente_salvar_passagem", { p_texto: campo.value });
      if (error){
        console.error("Assistente: erro ao salvar passagem", error);
        alert("Não deu pra salvar a passagem. Tenta de novo — nada foi perdido.");
        salvar.disabled = false;
        salvar.textContent = "Salvar nova versão";
        return;
      }
      estado.passagens = await buscar("assistente_passagens").catch(() => estado.passagens);
      renderizar();
    });
    $("assistPassagemCopiar").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(campo.value);
        e.target.textContent = "Copiado!";
        setTimeout(() => { e.target.textContent = "Copiar"; }, 2000);
      } catch (erro) {
        campo.select();
        alert("Não deu pra copiar sozinho. O texto ficou selecionado: aperte Ctrl+C.");
      }
    });
  }

  /* ------------------------------ Modal ------------------------------ */

  const CAMPOS = {
    pendencia: {
      tabela: "assistente_pendencias", lista: "pendencias", titulo: "pendência",
      campos: [
        { nome: "titulo", rotulo: "Título", tipo: "text", obrigatorio: true },
        { nome: "descricao", rotulo: "Descrição", tipo: "textarea" },
        { nome: "categoria", rotulo: "Categoria", tipo: "select", opcoes: CATEGORIAS, padrao: "Outros" },
        { nome: "prioridade", rotulo: "Prioridade", tipo: "select", opcoes: [1, 2, 3, 4].map(n => ({ valor: n, rotulo: `${n} · ${PRIORIDADES[n]}` })), padrao: 4, numero: true },
        { nome: "quadrante", rotulo: "Quadrante", tipo: "select", opcoes: [{ valor: "", rotulo: "Sem quadrante" }].concat(QUADRANTES.map(q => ({ valor: q.nome, rotulo: `${q.nome} (${q.titulo.toLowerCase()})` }))), padrao: "" },
        { nome: "status", rotulo: "Status", tipo: "select", opcoes: STATUS_PENDENCIA, padrao: "Pendente" },
        { nome: "data_limite", rotulo: "Data limite (opcional)", tipo: "date" },
        { nome: "data_agendada", rotulo: "Data agendada (opcional, usada no Programe-se)", tipo: "date" }
      ]
    },
    indicacao: {
      tabela: "assistente_indicacoes", lista: "indicacoes", titulo: "indicação",
      campos: [
        { nome: "produto", rotulo: "Produto", tipo: "text", obrigatorio: true },
        { nome: "marca_modelo", rotulo: "Marca e modelo", tipo: "text" },
        { nome: "detalhes", rotulo: "Detalhes", tipo: "textarea" },
        { nome: "quem_indicou", rotulo: "Quem indicou", tipo: "text", sugestoes: true },
        { nome: "link", rotulo: "Link (opcional)", tipo: "text" },
        { nome: "status", rotulo: "Status", tipo: "select", opcoes: STATUS_INDICACAO, padrao: "Quero comprar" }
      ]
    },
    lembrete: {
      tabela: "assistente_lembretes", lista: "lembretes", titulo: "lembrete",
      campos: [
        { nome: "texto", rotulo: "Lembrete", tipo: "textarea", obrigatorio: true },
        { nome: "data", rotulo: "Data", tipo: "date", obrigatorio: true },
        { nome: "status", rotulo: "Status", tipo: "select", opcoes: STATUS_LEMBRETE, padrao: "Pendente" }
      ]
    }
  };

  function abrirModal(tipo, id){
    const cfg = CAMPOS[tipo];
    const item = id ? estado[cfg.lista].find(x => x.id === id) : null;
    estado.modal = { tipo, id: item ? id : null };
    $("assistenteModalTitulo").textContent = (item ? "Editar " : "Nova ") + cfg.titulo;
    if (tipo === "lembrete" && !item) $("assistenteModalTitulo").textContent = "Novo lembrete";

    const nomesIndicou = [...new Set(estado.indicacoes.map(i => (i.quem_indicou || "").trim()).filter(Boolean))];
    $("assistenteModalCampos").innerHTML = cfg.campos.map(c => {
      const valor = item ? (item[c.nome] ?? "") : (c.padrao ?? (c.tipo === "date" && tipo === "lembrete" ? hojeISO() : ""));
      const idCampo = `assistCampo_${c.nome}`;
      let controle;
      if (c.tipo === "textarea"){
        controle = `<textarea id="${idCampo}" rows="${c.nome === "texto" ? 3 : 5}">${esc(valor)}</textarea>`;
      } else if (c.tipo === "select"){
        controle = `<select id="${idCampo}">${c.opcoes.map(o => {
          const v = typeof o === "object" ? o.valor : o;
          const r = typeof o === "object" ? o.rotulo : o;
          return `<option value="${esc(v)}"${String(v) === String(valor) ? " selected" : ""}>${esc(r)}</option>`;
        }).join("")}</select>`;
      } else {
        controle = `<input type="${c.tipo}" id="${idCampo}" value="${esc(valor)}"${c.sugestoes ? ` list="assistListaIndicou"` : ""}>`;
      }
      return `<div class="ugc-campo largo"><label for="${idCampo}">${esc(c.rotulo)}</label>${controle}</div>`;
    }).join("") + `<datalist id="assistListaIndicou">${nomesIndicou.map(n => `<option value="${esc(n)}">`).join("")}</datalist>`;

    $("assistenteModal").classList.remove("oculto");
    const primeiro = $("assistenteModalCampos").querySelector("input, textarea");
    if (primeiro) primeiro.focus();
  }

  function fecharModal(){
    $("assistenteModal").classList.add("oculto");
    estado.modal = null;
  }

  async function salvarModal(){
    if (!estado.modal) return;
    const cfg = CAMPOS[estado.modal.tipo];
    const dados = {};
    for (const c of cfg.campos){
      let v = $(`assistCampo_${c.nome}`).value;
      if (typeof v === "string" && c.tipo !== "textarea") v = v.trim();
      if (c.obrigatorio && !String(v).trim()){
        alert(`Preencha o campo "${c.rotulo}".`);
        $(`assistCampo_${c.nome}`).focus();
        return;
      }
      if (c.numero) v = Number(v);
      if (v === "") v = null;
      dados[c.nome] = v;
    }

    const botao = $("assistenteModalSalvar");
    botao.disabled = true;
    botao.textContent = "Salvando…";
    try {
      let resposta;
      if (estado.modal.id){
        resposta = await Auth.client.from(cfg.tabela).update(dados).eq("id", estado.modal.id).select();
      } else {
        resposta = await Auth.client.from(cfg.tabela).insert(dados).select();
      }
      if (resposta.error) throw resposta.error;
      if (!resposta.data || !resposta.data.length) throw new Error("Nada foi salvo (sem permissão?)");
      const salvo = resposta.data[0];
      const lista = estado[cfg.lista];
      const indice = lista.findIndex(x => x.id === salvo.id);
      if (indice >= 0) lista[indice] = salvo; else lista.unshift(salvo);
      fecharModal();
      renderizar();
    } catch (erro) {
      console.error("Assistente: erro ao salvar", erro);
      alert("Não deu pra salvar agora. Tenta de novo — nada foi perdido.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar";
    }
  }

  // Atualiza um campo só (status ou quadrante) direto do card
  async function mudarCampo(tabela, id, campo, valor, select){
    const nomeLista = { assistente_pendencias: "pendencias", assistente_indicacoes: "indicacoes", assistente_lembretes: "lembretes" }[tabela];
    const item = estado[nomeLista].find(x => x.id === id);
    if (!item || (item[campo] ?? null) === (valor ?? null)) return;
    const anterior = item[campo];
    if (select) select.disabled = true;
    const { data, error } = await Auth.client.from(tabela).update({ [campo]: valor }).eq("id", id).select();
    if (error || !data || !data.length){
      console.error("Assistente: erro ao atualizar " + campo, error);
      alert("Não deu pra salvar a mudança. Tenta de novo.");
      if (select){ select.value = anterior ?? ""; select.disabled = false; }
      return;
    }
    Object.assign(item, data[0]);
    renderizar();
  }
  const mudarStatus = (tabela, id, status, select) => mudarCampo(tabela, id, "status", status, select);
  const mudarQuadrante = (id, quadrante, select) => mudarCampo("assistente_pendencias", id, "quadrante", quadrante || null, select);

  /* ------------------------------ Eventos ------------------------------ */

  function ligarEventos(){
    document.querySelectorAll("#assistenteSubAbas .sub-aba-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        estado.subaba = btn.dataset.subabaAssist;
        try { sessionStorage.setItem("assistenteSubAba", estado.subaba); } catch (e) {}
        renderizar();
      });
    });

    const conteudo = $("assistenteConteudo");
    conteudo.addEventListener("click", (e) => {
      const alvo = e.target.closest("[data-acao]");
      if (!alvo) return;
      const acao = alvo.dataset.acao;
      if (acao === "assist-novo" && alvo.dataset.tipo === "pendencia") abrirCardPendencia(null);
      else if (acao === "assist-pend-abrir") abrirCardPendencia(alvo.dataset.id);
      else if (acao === "assist-novo") abrirModal(alvo.dataset.tipo);
      else if (acao === "assist-editar") abrirModal(alvo.dataset.tipo, alvo.dataset.id);
      else if (acao === "assist-alternar"){
        const id = alvo.dataset.id;
        estado.abertos.has(id) ? estado.abertos.delete(id) : estado.abertos.add(id);
        renderizar();
      }
      else if (acao === "assist-cores-alternar"){
        estado.painelCoresAberto = !estado.painelCoresAberto;
        if (!estado.painelCoresAberto) estado.coresSalvas = "";
        renderizar();
      }
      else if (acao === "assist-cores-original"){
        estado.cores = Object.assign({ intensidade: INTENSIDADE_PADRAO }, CORES_ORIGINAIS);
        aplicarCores();
        renderizar();
        salvarCoresDepois();
      }
      else if (acao === "assist-quad-alternar"){
        // Sanfona: só faz diferença no celular (no computador os 4 ficam sempre abertos)
        const nome = alvo.dataset.quadrante;
        estado.quadAbertos.has(nome) ? estado.quadAbertos.delete(nome) : estado.quadAbertos.add(nome);
        const secao = alvo.closest(".assist-quad");
        secao.classList.toggle("aberto", estado.quadAbertos.has(nome));
        alvo.setAttribute("aria-expanded", String(estado.quadAbertos.has(nome)));
      }
    });

    // ---------- Cores: muda na hora enquanto mexe, salva sozinho logo depois ----------
    conteudo.addEventListener("input", (e) => {
      const alvo = e.target;
      if (alvo.dataset.acao === "assist-cor" && HEX.test(alvo.value)){
        estado.cores[alvo.dataset.q] = alvo.value;
      } else if (alvo.dataset.acao === "assist-intensidade"){
        estado.cores.intensidade = Math.min(100, Math.max(INTENSIDADE_MIN, Number(alvo.value) || INTENSIDADE_PADRAO));
      } else return;
      aplicarCores();
      salvarCoresDepois();
    });

    // ---------- Arrastar card entre quadrantes (computador) ----------
    let arrastandoId = null;
    conteudo.addEventListener("dragstart", (e) => {
      const card = e.target.closest && e.target.closest("[data-arrastar-id]");
      if (!card) return;
      arrastandoId = card.dataset.arrastarId;
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", arrastandoId); } catch (erro) {}
      card.classList.add("arrastando");
    });
    conteudo.addEventListener("dragend", (e) => {
      const card = e.target.closest && e.target.closest("[data-arrastar-id]");
      if (card) card.classList.remove("arrastando");
      conteudo.querySelectorAll(".soltar-aqui").forEach(el => el.classList.remove("soltar-aqui"));
      arrastandoId = null;
    });
    conteudo.addEventListener("dragover", (e) => {
      const zona = e.target.closest && e.target.closest("[data-soltar-quadrante]");
      if (!zona || !arrastandoId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      conteudo.querySelectorAll(".soltar-aqui").forEach(el => { if (el !== zona) el.classList.remove("soltar-aqui"); });
      zona.classList.add("soltar-aqui");
    });
    conteudo.addEventListener("drop", (e) => {
      const zona = e.target.closest && e.target.closest("[data-soltar-quadrante]");
      if (!zona || !arrastandoId) return;
      e.preventDefault();
      const id = arrastandoId;
      arrastandoId = null;
      zona.classList.remove("soltar-aqui");
      mudarQuadrante(id, zona.dataset.soltarQuadrante, null);
    });
    conteudo.addEventListener("change", (e) => {
      const alvo = e.target.closest("[data-acao]");
      if (!alvo) return;
      const acao = alvo.dataset.acao;
      if (acao === "assist-status") mudarStatus(alvo.dataset.tabela, alvo.dataset.id, alvo.value, alvo);
      else if (acao === "assist-quadrante") mudarQuadrante(alvo.dataset.id, alvo.value, alvo);
      else if (acao === "assist-filtro-categoria"){ estado.filtroCategoria = alvo.value; renderizar(); }
      else if (acao === "assist-filtro-status"){ estado.filtroStatus = alvo.value; renderizar(); }
      else if (acao === "assist-mostrar-feitos"){
        if (alvo.dataset.lista === "pendencias") estado.mostrarFeitosPendencias = alvo.checked;
        else estado.mostrarFeitosLembretes = alvo.checked;
        renderizar();
      }
    });
    // ---------- Card da pendência: botões, clicar fora e Esc ----------
    const caixaPend = $("assistPendCard");
    caixaPend.addEventListener("click", (e) => {
      if (e.target === caixaPend){ fecharCardPendencia(); return; }        // clicou fora do card
      const b = e.target.closest("[data-pend]");
      if (!b) return;
      if (b.dataset.pend === "fechar") fecharCardPendencia();
      else if (b.dataset.pend === "salvar") salvarCardPendencia(b);
      else if (b.dataset.pend === "descartar"){
        if (window.confirm("Descartar essa pendência? Ela some da matriz, mas não é apagada: aparece em \"Mostrar feitos e descartados\".")){
          salvarCardPendencia(b, { status: "Descartado" });
        }
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharCardPendencia(); });

    // Lembra quais grupos de "quem indicou" estão abertos (sem isso fechariam a cada mudança)
    conteudo.addEventListener("toggle", (e) => {
      const grupo = e.target.closest && e.target.closest(".assist-grupo");
      if (!grupo || e.target !== grupo) return;
      grupo.open ? estado.gruposAbertos.add(grupo.dataset.grupo) : estado.gruposAbertos.delete(grupo.dataset.grupo);
    }, true);

    $("assistenteModalFechar").addEventListener("click", fecharModal);
    $("assistenteModalCancelar").addEventListener("click", fecharModal);
    $("assistenteModalSalvar").addEventListener("click", salvarModal);
    $("assistenteModal").addEventListener("click", (e) => { if (e.target.id === "assistenteModal") fecharModal(); });
  }

  try {
    const salva = sessionStorage.getItem("assistenteSubAba");
    if (["pendencias", "indicacoes", "lembretes", "passagem"].includes(salva)) estado.subaba = salva;
  } catch (e) {}

  ligarEventos();

  // Chamado pelo trocarAba("assistente") no painel.html
  window.carregarAssistente = () => carregar(false);

  // Se o painel já voltou direto pra esta aba (F5) antes deste arquivo carregar
  const secao = $("painelAssistente");
  if (secao && !secao.classList.contains("oculto")) carregar(false);
})();
