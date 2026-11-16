/* =========================================================================
   ABA INSTAGRAM > "CRONOGRAMA DE CONTEÚDOS"
   Tudo desta sub-aba mora aqui. Tabela: assistente_cronograma (ver
   assistente_cronograma.sql). Regras que o BANCO garante sozinho (valem também
   pro conector do Claude):
   - status "Postado" => vai pra Postados (data de hoje se não vier data);
   - sai do "Postado" => volta pra Grade, no fim do bloco do dia;
   - ideia nova sem posição => fim do bloco do dia;
   - a posição nunca muda sozinha fora isso.
   Não existe apagar: pra tirar uma ideia, status "Descartado".
   ========================================================================= */
(function(){
  const DIAS = [
    { nome: "Segunda",   cor: "#4A86E8" },
    { nome: "Terça",     cor: "#2BB3A3" },
    { nome: "Quarta",    cor: "#34A853" },
    { nome: "Quinta",    cor: "#FF9900" },
    { nome: "Sexta",     cor: "#D63384" },
    { nome: "Sábado",    cor: "#8E44AD" },
    { nome: "Domingo",   cor: "#F1C232" },
    { nome: "Extra",     cor: "#8C8C8C" },
    { nome: "Stories",   cor: "#F28B82" },
    { nome: "A definir", cor: "#DADADA" }
  ];
  const STATUS = [
    { nome: "Sugestão (aprovar)",     cor: "#9AA0A6" },
    { nome: "Ideia aprovada",         cor: "#4A86E8" },
    { nome: "Roteiro pronto",         cor: "#2BB3A3" },
    { nome: "A gravar",               cor: "#F1C232" },
    { nome: "Em produção",            cor: "#FF9900" },
    { nome: "Gravado (falta editar)", cor: "#8E44AD" },
    { nome: "Em teste",               cor: "#D63384" },
    { nome: "Postado",                cor: "#34A853" },
    { nome: "A confirmar",            cor: "#E53935" },
    { nome: "Descartado",             cor: "#4B4B4B" }
  ];
  const METRICAS = [
    { campo: "visualizacoes",      rotulo: "Visualizações",           tipo: "int" },
    { campo: "alcance",            rotulo: "Alcance",                 tipo: "int" },
    { campo: "nao_seguidores_pct", rotulo: "Não seguidores (%)",      tipo: "pct" },
    { campo: "tempo_medio_seg",    rotulo: "Tempo médio (segundos)",  tipo: "dec" },
    { campo: "taxa_pulo_pct",      rotulo: "Taxa de pulo (%)",        tipo: "pct" },
    { campo: "curtidas",           rotulo: "Curtidas",                tipo: "int" },
    { campo: "comentarios",        rotulo: "Comentários",             tipo: "int" },
    { campo: "compartilhamentos",  rotulo: "Compartilhamentos",       tipo: "int" },
    { campo: "salvamentos",        rotulo: "Salvamentos",             tipo: "int" },
    { campo: "seguidores_ganhos",  rotulo: "Seguidores ganhos",       tipo: "int" }
  ];
  const TABELA = "assistente_cronograma";

  const estado = {
    carregado: false, carregando: false,
    itens: [],
    lista: "Grade",
    filtroDia: "", filtroStatus: "", busca: "",
    mostrarDescartados: false,
    abertos: new Set(),          // linhas/cartões com detalhes abertos
    editandoObs: null,           // id com observações em edição
    pendentePostado: null        // { id, select, anterior } esperando a data de postagem
  };

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const celular = () => window.matchMedia("(max-width: 700px)").matches;
  const corDia = (n) => (DIAS.find(d => d.nome === n) || DIAS[9]).cor;
  const corStatus = (n) => (STATUS.find(s => s.nome === n) || STATUS[0]).cor;

  function textoSobre(hex){
    const n = parseInt(hex.slice(1), 16);
    const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
    return 1.05 / (L + 0.05) > (L + 0.05) / 0.0556 ? "#FFFFFF" : "#111111";
  }
  const estiloPilula = (hex) => `background:${hex};color:${textoSobre(hex)};`;

  function hojeISO(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function dataBR(iso){
    if (!iso) return "";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }
  function diasDesde(iso){
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((hoje - new Date(a, m - 1, d)) / 86400000);
  }
  // Link do roteiro: só https:// e endereço válido; devolve "" se não servir
  function linkSeguro(url){
    const u = String(url || "").trim();
    if (!/^https:\/\//i.test(u) || u.length > 2000) return "";
    try { new URL(u); return u; } catch (e) { return ""; }
  }
  const iconeRoteiro = (it) => {
    const link = linkSeguro(it.link_roteiro);
    return link ? `<a class="cron-link-roteiro" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="Abrir o roteiro (nova aba)">📄</a>` : "";
  };

  const semMetricas = (it) => METRICAS.every(m => it[m.campo] === null || it[m.campo] === undefined);
  const metricasPendentes = (it) => it.lista === "Postados" && it.data_postagem && diasDesde(it.data_postagem) >= 2 && semMetricas(it);
  const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  /* ------------------------------ Dados ------------------------------ */
  async function carregar(forcar){
    const raiz = $("cronogramaRaiz");
    if (!raiz || estado.carregando) return;
    if (estado.carregado && !forcar){ renderizar(); return; }
    estado.carregando = true;
    raiz.innerHTML = `<p class="cron-vazio">Carregando cronograma…</p>`;
    try {
      let tudo = [], inicio = 0;
      while (true) {
        const { data, error } = await Auth.client.from(TABELA).select("*").order("posicao", { ascending: true }).range(inicio, inicio + 999);
        if (error) throw error;
        tudo = tudo.concat(data || []);
        if (!data || data.length < 1000) break;
        inicio += 1000;
      }
      estado.itens = tudo;
      estado.carregado = true;
      renderizar();
    } catch (erro) {
      console.error("Cronograma: erro ao carregar", erro);
      raiz.innerHTML = `<p class="cron-vazio">Não deu pra carregar o cronograma agora. <button type="button" class="btn-fantasma" data-cron="recarregar">Tentar de novo</button></p>`;
    } finally {
      estado.carregando = false;
    }
  }

  async function salvar(id, campos){
    const { data, error } = await Auth.client.from(TABELA).update(campos).eq("id", id).select();
    if (error || !data || !data.length){
      console.error("Cronograma: erro ao salvar", error);
      alert("Não deu pra salvar a mudança. Tenta de novo — nada foi perdido.");
      renderizarLista();
      return null;
    }
    const i = estado.itens.findIndex(x => x.id === id);
    if (i >= 0) estado.itens[i] = data[0];
    renderizar();
    return data[0];
  }

  /* --------------------------- Listas visíveis --------------------------- */
  const gradeOrdenada = () => estado.itens.filter(x => x.lista === "Grade").sort((a, b) => a.posicao - b.posicao);

  function itensVisiveis(){
    let lista = estado.lista === "Grade"
      ? gradeOrdenada()
      : estado.itens.filter(x => x.lista === "Postados").sort((a, b) =>
          String(b.data_postagem || "").localeCompare(String(a.data_postagem || "")) || String(b.created_at).localeCompare(String(a.created_at)));
    if (estado.filtroStatus) lista = lista.filter(x => x.status === estado.filtroStatus);
    else if (!estado.mostrarDescartados) lista = lista.filter(x => x.status !== "Descartado");
    if (estado.filtroDia) lista = lista.filter(x => x.dia === estado.filtroDia);
    if (estado.busca.trim()){
      const termo = normalizar(estado.busca.trim());
      lista = lista.filter(x => normalizar(x.ideia).includes(termo) || normalizar(x.observacoes).includes(termo));
    }
    return lista;
  }

  /* ------------------------------ Telas ------------------------------ */
  function opcoesHtml(lista, atual){
    return lista.map(o => `<option value="${esc(o.nome)}"${o.nome === atual ? " selected" : ""}>${esc(o.nome)}</option>`).join("");
  }

  function renderizar(){
    const raiz = $("cronogramaRaiz");
    if (!raiz) return;
    const nGrade = estado.itens.filter(x => x.lista === "Grade" && x.status !== "Descartado").length;
    const nPostados = estado.itens.filter(x => x.lista === "Postados").length;
    const nPendentes = estado.itens.filter(metricasPendentes).length;
    const nDescartados = estado.itens.filter(x => x.lista === estado.lista && x.status === "Descartado").length;
    const buscaComFoco = document.activeElement && document.activeElement.id === "cronBusca";

    raiz.innerHTML = `
      <div class="cron-topo">
        <div class="ig-subabas-mini cron-listas">
          <button type="button" class="sub-aba-btn${estado.lista === "Grade" ? " ativo" : ""}" data-cron="lista" data-lista="Grade">Grade <span class="contagem-subaba">${nGrade}</span></button>
          <button type="button" class="sub-aba-btn${estado.lista === "Postados" ? " ativo" : ""}" data-cron="lista" data-lista="Postados">Postados <span class="contagem-subaba">${nPostados}</span>${nPendentes ? ` <span class="cron-badge-pendente" title="Itens com métricas pendentes">⏳ ${nPendentes}</span>` : ""}</button>
        </div>
        <button type="button" class="botao-add-tarefa" data-cron="nova">+ Nova ideia</button>
      </div>
      <div class="cron-filtros">
        <label>Dia
          <select data-cron="filtro-dia"><option value="">Todos</option>${opcoesHtml(DIAS, estado.filtroDia)}</select>
        </label>
        <label>Status
          <select data-cron="filtro-status"><option value="">Todos</option>${opcoesHtml(STATUS, estado.filtroStatus)}</select>
        </label>
        <label class="cron-busca">Buscar
          <input type="search" id="cronBusca" placeholder="Palavra na ideia ou nas observações" value="${esc(estado.busca)}">
        </label>
        ${estado.filtroStatus ? "" : `<label class="cron-check"><input type="checkbox" data-cron="mostrar-descartados"${estado.mostrarDescartados ? " checked" : ""}> Mostrar descartados (${nDescartados})</label>`}
      </div>
      <div id="cronLista"></div>
    `;
    renderizarLista();
    if (buscaComFoco){
      const b = $("cronBusca");
      b.focus();
      b.setSelectionRange(b.value.length, b.value.length);
    }
  }

  function renderizarLista(){
    const alvo = $("cronLista");
    if (!alvo) return;
    const lista = itensVisiveis();
    if (!lista.length){
      alvo.innerHTML = `<p class="cron-vazio">${estado.busca || estado.filtroDia || estado.filtroStatus ? "Nada encontrado com esses filtros." : estado.lista === "Grade" ? "Nenhuma ideia na Grade ainda." : "Nenhum post ainda."}</p>`;
      return;
    }
    alvo.innerHTML = celular() ? lista.map(cartaoCelular).join("") : tabelaComputador(lista);
  }

  // ---------- Computador: linhas finas ----------
  function tabelaComputador(lista){
    const postados = estado.lista === "Postados";
    const podeArrastar = !postados;
    return `
      <div class="cron-tabela${postados ? " postados" : ""}">
        <div class="cron-linha cron-cabecalho">
          <span></span><span>Dia</span><span>Tema</span><span>Ideia</span><span>Formato</span><span>Status</span>${postados ? "<span>Postado em</span>" : ""}<span>Observações</span>
        </div>
        ${lista.map(it => {
          const aberto = estado.abertos.has(it.id);
          return `
          <div class="cron-bloco${it.status === "Descartado" ? " descartado" : ""}${aberto ? " aberto" : ""}" data-id="${it.id}">
            <div class="cron-linha">
              <span class="cron-alca"${podeArrastar ? ` draggable="true" title="Arraste pra mudar a ordem"` : ""}>${podeArrastar ? "⋮⋮" : ""}</span>
              <select class="cron-pilula" style="${estiloPilula(corDia(it.dia))}" data-cron="campo-select" data-campo="dia" data-id="${it.id}" aria-label="Dia">${opcoesHtml(DIAS, it.dia)}</select>
              <span class="cron-texto" data-cron="editar-texto" data-campo="tema" data-id="${it.id}" title="${esc(it.tema)}">${esc(it.tema) || '<span class="cron-placeholder">—</span>'}</span>
              <span class="cron-texto cron-ideia" data-cron="editar-texto" data-campo="ideia" data-id="${it.id}" title="${esc(it.ideia)}">${esc(it.ideia) || '<span class="cron-placeholder">—</span>'}</span>
              <span class="cron-texto" data-cron="editar-texto" data-campo="formato" data-id="${it.id}" title="${esc(it.formato)}">${esc(it.formato) || '<span class="cron-placeholder">—</span>'}</span>
              <select class="cron-pilula" style="${estiloPilula(corStatus(it.status))}" data-cron="campo-select" data-campo="status" data-id="${it.id}" aria-label="Status">${opcoesHtml(STATUS, it.status)}</select>
              ${postados ? `<input type="date" class="cron-data" value="${esc(it.data_postagem || "")}" data-cron="data-postagem" data-id="${it.id}" aria-label="Data de postagem">` : ""}
              <span class="cron-obs-celula">
                ${iconeRoteiro(it)}
                <button type="button" class="cron-ver-mais" data-cron="alternar" data-id="${it.id}">${aberto ? "▾ fechar" : it.observacoes ? "▸ ver mais" : "▸ abrir"}</button>
                ${metricasPendentes(it) ? `<span class="cron-badge-pendente" title="Já passaram 48h: preencha as métricas">⏳ métricas pendentes</span>` : ""}
              </span>
            </div>
            ${aberto ? detalhes(it) : ""}
          </div>`;
        }).join("")}
      </div>`;
  }

  // ---------- Celular: cartões compactos ----------
  function cartaoCelular(it){
    const aberto = estado.abertos.has(it.id);
    const grade = estado.lista === "Grade";
    return `
      <div class="cron-cartao${it.status === "Descartado" ? " descartado" : ""}${aberto ? " aberto" : ""}" data-id="${it.id}">
        <div class="cron-cartao-topo">
          <button type="button" class="cron-cartao-resumo" data-cron="alternar" data-id="${it.id}" aria-expanded="${aberto}">
            <span class="cron-pilula-fixa" style="${estiloPilula(corDia(it.dia))}">${esc(it.dia)}</span>
            <span class="cron-cartao-ideia">${esc(it.ideia) || "—"}</span>
            ${linkSeguro(it.link_roteiro) ? `<span class="cron-tem-link" title="Tem link do roteiro">📄</span>` : ""}
            <span class="cron-pilula-fixa" style="${estiloPilula(corStatus(it.status))}">${esc(it.status)}</span>
            ${metricasPendentes(it) ? `<span class="cron-badge-pendente">⏳</span>` : ""}
          </button>
          ${grade ? `<span class="cron-setas">
            <button type="button" data-cron="subir" data-id="${it.id}" aria-label="Subir">↑</button>
            <button type="button" data-cron="descer" data-id="${it.id}" aria-label="Descer">↓</button>
          </span>` : ""}
        </div>
        ${aberto ? `
          <div class="cron-cartao-campos">
            <label>Dia<select class="cron-pilula" style="${estiloPilula(corDia(it.dia))}" data-cron="campo-select" data-campo="dia" data-id="${it.id}">${opcoesHtml(DIAS, it.dia)}</select></label>
            <label>Status<select class="cron-pilula" style="${estiloPilula(corStatus(it.status))}" data-cron="campo-select" data-campo="status" data-id="${it.id}">${opcoesHtml(STATUS, it.status)}</select></label>
            <label>Tema<input type="text" value="${esc(it.tema)}" data-cron="campo-texto" data-campo="tema" data-id="${it.id}"></label>
            <label>Ideia<input type="text" value="${esc(it.ideia)}" data-cron="campo-texto" data-campo="ideia" data-id="${it.id}"></label>
            <label>Formato<input type="text" value="${esc(it.formato)}" data-cron="campo-texto" data-campo="formato" data-id="${it.id}"></label>
            ${it.lista === "Postados" ? `<label>Postado em<input type="date" value="${esc(it.data_postagem || "")}" data-cron="data-postagem" data-id="${it.id}"></label>` : ""}
          </div>
          ${detalhes(it)}` : ""}
      </div>`;
  }

  // ---------- Observações (+ métricas em Postados) ----------
  function detalhes(it){
    const editando = estado.editandoObs === it.id;
    const obs = editando
      ? `<textarea class="cron-obs-editar" id="cronObsTexto-${it.id}" rows="12">${esc(it.observacoes || "")}</textarea>
         <div class="cron-botoes">
           <button type="button" class="btn-fantasma" data-cron="obs-cancelar" data-id="${it.id}">Cancelar</button>
           <button type="button" class="botao-add-tarefa" data-cron="obs-salvar" data-id="${it.id}">Salvar observações</button>
         </div>`
      : `<div class="cron-obs-texto">${it.observacoes ? esc(it.observacoes) : '<span class="cron-placeholder">Sem observações.</span>'}</div>
         <div class="cron-botoes">
           ${it.observacoes ? `<button type="button" class="btn-fantasma" data-cron="obs-copiar" data-id="${it.id}">Copiar</button>` : ""}
           <button type="button" class="btn-fantasma" data-cron="obs-editar" data-id="${it.id}">Editar observações</button>
         </div>`;
    const metricas = it.lista !== "Postados" ? "" : `
      <div class="cron-metricas">
        <div class="cron-metricas-titulo">Métricas (48h depois de postar)${metricasPendentes(it) ? ` <span class="cron-badge-pendente">⏳ pendentes</span>` : ""}</div>
        <div class="cron-metricas-grade">
          ${METRICAS.map(m => `<label>${esc(m.rotulo)}<input type="number" inputmode="decimal" min="0"${m.tipo === "pct" ? ` max="100"` : ""} step="${m.tipo === "int" ? "1" : "0.01"}" value="${it[m.campo] ?? ""}" data-metrica="${m.campo}"></label>`).join("")}
        </div>
        <label class="cron-metricas-anotacao">Anotação<textarea rows="3" data-metrica="anotacao_metricas">${esc(it.anotacao_metricas || "")}</textarea></label>
        <div class="cron-botoes"><span class="cron-status-salvo" id="cronMetricasStatus-${it.id}"></span><button type="button" class="botao-add-tarefa" data-cron="metricas-salvar" data-id="${it.id}">Salvar métricas</button></div>
      </div>`;
    const link = linkSeguro(it.link_roteiro);
    const blocoLink = `
      <div class="cron-link-bloco">
        <label>Link do roteiro
          <input type="url" inputmode="url" placeholder="https://…" value="${esc(it.link_roteiro || "")}" data-cron="campo-link" data-id="${it.id}">
        </label>
        ${link ? `<a class="btn-fantasma cron-link-abrir" href="${esc(link)}" target="_blank" rel="noopener noreferrer">📄 Abrir roteiro</a>` : ""}
      </div>`;
    return `<div class="cron-detalhes">${blocoLink}<div class="cron-detalhes-rotulo">Observações</div>${obs}${metricas}</div>`;
  }

  /* ------------------------------ Ações ------------------------------ */
  async function mudarCampoSelect(sel){
    const id = sel.dataset.id, campo = sel.dataset.campo, valor = sel.value;
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    if (campo === "status" && valor === "Postado" && it.status !== "Postado"){
      // Pede a data de postagem antes (já com hoje)
      estado.pendentePostado = { id, sel, anterior: it.status };
      $("cronDataPostagemCampo").value = hojeISO();
      $("cronModalPostado").classList.remove("oculto");
      $("cronDataPostagemCampo").focus();
      return;
    }
    sel.disabled = true;
    await salvar(id, { [campo]: valor });
  }

  function editarTexto(span){
    if (span.querySelector("input")) return;
    const id = span.dataset.id, campo = span.dataset.campo;
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    const input = document.createElement("input");
    input.type = "text"; input.value = it[campo] || ""; input.className = "cron-input-inline";
    span.replaceChildren(input);
    input.focus(); input.select();
    let terminou = false;
    const fim = async (gravar) => {
      if (terminou) return; terminou = true;
      const novo = input.value;
      if (gravar && novo !== (it[campo] || "")) await salvar(id, { [campo]: novo === "" ? null : novo });
      else renderizarLista();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){ e.preventDefault(); fim(true); }
      else if (e.key === "Escape"){ e.preventDefault(); fim(false); }
    });
    input.addEventListener("blur", () => fim(true));
  }

  // Coloca "id" antes/depois de "alvoId" na Grade, mexendo só na posição do item movido
  async function moverPara(id, alvoId, lado){
    if (id === alvoId) return;
    const grade = gradeOrdenada().filter(x => x.id !== id);
    const i = grade.findIndex(x => x.id === alvoId);
    if (i < 0) return;
    let nova;
    if (lado === "antes"){
      const anterior = grade[i - 1];
      nova = anterior ? (anterior.posicao + grade[i].posicao) / 2 : grade[i].posicao - 1;
    } else {
      const seguinte = grade[i + 1];
      nova = seguinte ? (grade[i].posicao + seguinte.posicao) / 2 : grade[i].posicao + 1;
    }
    const it = estado.itens.find(x => x.id === id);
    const anteriorPos = it.posicao;
    it.posicao = nova;            // mostra na hora
    renderizarLista();
    const ok = await salvar(id, { posicao: nova });
    if (!ok){ it.posicao = anteriorPos; renderizarLista(); }
  }

  function subirDescer(id, direcao){
    const visiveis = itensVisiveis();
    const i = visiveis.findIndex(x => x.id === id);
    const vizinho = visiveis[direcao === "subir" ? i - 1 : i + 1];
    if (vizinho) moverPara(id, vizinho.id, direcao === "subir" ? "antes" : "depois");
  }

  async function salvarMetricas(id, botao){
    const caixa = botao.closest(".cron-metricas");
    const campos = {};
    for (const el of caixa.querySelectorAll("[data-metrica]")){
      const campo = el.dataset.metrica;
      if (campo === "anotacao_metricas"){ campos[campo] = el.value.trim() === "" ? null : el.value; continue; }
      const def = METRICAS.find(m => m.campo === campo);
      const bruto = el.value.trim().replace(",", ".");
      if (bruto === ""){ campos[campo] = null; continue; }
      const n = Number(bruto);
      if (!isFinite(n) || n < 0 || (def.tipo === "pct" && n > 100) || (def.tipo === "int" && !Number.isInteger(n))){
        alert(`Confere o campo "${def.rotulo}": ${def.tipo === "int" ? "número inteiro" : def.tipo === "pct" ? "porcentagem de 0 a 100" : "número"}, sem negativo.`);
        el.focus();
        return;
      }
      campos[campo] = n;
    }
    botao.disabled = true; botao.textContent = "Salvando…";
    const ok = await salvar(id, campos);
    const status = $(`cronMetricasStatus-${id}`);
    if (ok && status) status.textContent = "Salvo ✓";
  }

  /* ------------------------------ Nova ideia ------------------------------ */
  function abrirNova(){
    $("cronNovaDia").innerHTML = opcoesHtml(DIAS, estado.filtroDia || "A definir");
    $("cronNovaStatus").innerHTML = opcoesHtml(STATUS.filter(s => s.nome !== "Postado"), "Sugestão (aprovar)");
    ["cronNovaTema", "cronNovaIdeia", "cronNovaFormato", "cronNovaObs", "cronNovaLink"].forEach(id => { $(id).value = ""; });
    $("cronModalNova").classList.remove("oculto");
    $("cronNovaIdeia").focus();
  }

  async function salvarNova(){
    const ideia = $("cronNovaIdeia").value;
    if (!ideia.trim()){ alert("Escreve a ideia."); $("cronNovaIdeia").focus(); return; }
    const vazioNulo = (v) => v.trim() === "" ? null : v;
    const link = $("cronNovaLink").value.trim();
    if (link && !linkSeguro(link)){ alert("O link do roteiro precisa começar com https://"); $("cronNovaLink").focus(); return; }
    const linha = {
      link_roteiro: link || null,
      dia: $("cronNovaDia").value,
      tema: vazioNulo($("cronNovaTema").value),
      ideia,
      formato: vazioNulo($("cronNovaFormato").value),
      status: $("cronNovaStatus").value,
      observacoes: vazioNulo($("cronNovaObs").value)
    };
    const botao = $("cronNovaSalvar");
    botao.disabled = true; botao.textContent = "Salvando…";
    const { data, error } = await Auth.client.from(TABELA).insert(linha).select();
    botao.disabled = false; botao.textContent = "Salvar ideia";
    if (error || !data || !data.length){
      console.error("Cronograma: erro ao criar", error);
      alert("Não deu pra salvar a ideia. Tenta de novo — nada foi perdido.");
      return;
    }
    estado.itens.push(data[0]);
    $("cronModalNova").classList.add("oculto");
    estado.lista = "Grade";
    renderizar();
  }

  /* ------------------------------ Eventos ------------------------------ */
  function ligarEventos(){
    const raiz = $("cronogramaRaiz");
    if (!raiz) return;

    raiz.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-cron]");
      if (!el) return;
      const acao = el.dataset.cron, id = el.dataset.id;
      if (acao === "lista"){ estado.lista = el.dataset.lista; renderizar(); }
      else if (acao === "nova") abrirNova();
      else if (acao === "recarregar") carregar(true);
      else if (acao === "alternar"){
        estado.abertos.has(id) ? estado.abertos.delete(id) : estado.abertos.add(id);
        if (estado.editandoObs === id && !estado.abertos.has(id)) estado.editandoObs = null;
        renderizarLista();
      }
      else if (acao === "editar-texto") editarTexto(el);
      else if (acao === "subir" || acao === "descer") subirDescer(id, acao);
      else if (acao === "obs-editar"){ estado.editandoObs = id; renderizarLista(); const t = $(`cronObsTexto-${id}`); if (t) t.focus(); }
      else if (acao === "obs-cancelar"){ estado.editandoObs = null; renderizarLista(); }
      else if (acao === "obs-salvar"){
        const valor = $(`cronObsTexto-${id}`).value;
        el.disabled = true;
        estado.editandoObs = null;
        await salvar(id, { observacoes: valor.trim() === "" ? null : valor });
      }
      else if (acao === "obs-copiar"){
        const it = estado.itens.find(x => x.id === id);
        try { await navigator.clipboard.writeText(it.observacoes || ""); el.textContent = "Copiado!"; setTimeout(() => { el.textContent = "Copiar"; }, 2000); }
        catch (erro) { alert("Não deu pra copiar sozinho. Abra \"Editar observações\" e copie com Ctrl+C."); }
      }
      else if (acao === "metricas-salvar") salvarMetricas(id, el);
    });

    raiz.addEventListener("change", (e) => {
      const el = e.target;
      const acao = el.dataset.cron;
      if (acao === "campo-select") mudarCampoSelect(el);
      else if (acao === "filtro-dia"){ estado.filtroDia = el.value; renderizar(); }
      else if (acao === "filtro-status"){ estado.filtroStatus = el.value; renderizar(); }
      else if (acao === "mostrar-descartados"){ estado.mostrarDescartados = el.checked; renderizar(); }
      else if (acao === "data-postagem"){
        if (!el.value){ alert("A data de postagem não pode ficar vazia."); renderizarLista(); return; }
        salvar(el.dataset.id, { data_postagem: el.value });
      }
      else if (acao === "campo-link"){
        const it = estado.itens.find(x => x.id === el.dataset.id);
        const valor = el.value.trim();
        if (valor && !linkSeguro(valor)){
          alert("O link do roteiro precisa começar com https:// (copie o endereço completo do documento).");
          el.value = (it && it.link_roteiro) || "";
          return;
        }
        if (it && valor !== (it.link_roteiro || "")) salvar(el.dataset.id, { link_roteiro: valor || null });
      }
      else if (acao === "campo-texto"){
        const it = estado.itens.find(x => x.id === el.dataset.id);
        if (it && el.value !== (it[el.dataset.campo] || "")) salvar(el.dataset.id, { [el.dataset.campo]: el.value === "" ? null : el.value });
      }
    });

    let temporizadorBusca = null;
    raiz.addEventListener("input", (e) => {
      if (e.target.id !== "cronBusca") return;
      estado.busca = e.target.value;
      clearTimeout(temporizadorBusca);
      temporizadorBusca = setTimeout(renderizarLista, 200);
    });

    // ---------- Arrastar linhas (computador, só na Grade) ----------
    let arrastando = null;
    raiz.addEventListener("dragstart", (e) => {
      const alca = e.target.closest && e.target.closest(".cron-alca[draggable='true']");
      if (!alca) return;
      const bloco = alca.closest(".cron-bloco");
      arrastando = bloco.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", arrastando); e.dataTransfer.setDragImage(bloco, 12, 12); } catch (erro) {}
      bloco.classList.add("arrastando");
    });
    const limparMarcas = () => raiz.querySelectorAll(".solta-antes, .solta-depois").forEach(x => x.classList.remove("solta-antes", "solta-depois"));
    raiz.addEventListener("dragover", (e) => {
      if (!arrastando) return;
      const bloco = e.target.closest(".cron-bloco");
      if (!bloco || bloco.dataset.id === arrastando) return;
      e.preventDefault();
      const r = bloco.getBoundingClientRect();
      const antes = e.clientY < r.top + Math.min(r.height, 40) / 2;
      limparMarcas();
      bloco.classList.add(antes ? "solta-antes" : "solta-depois");
    });
    raiz.addEventListener("drop", (e) => {
      if (!arrastando) return;
      const bloco = e.target.closest(".cron-bloco");
      e.preventDefault();
      const id = arrastando;
      arrastando = null;
      if (!bloco || bloco.dataset.id === id){ limparMarcas(); return; }
      const lado = bloco.classList.contains("solta-antes") ? "antes" : "depois";
      limparMarcas();
      moverPara(id, bloco.dataset.id, lado);
    });
    raiz.addEventListener("dragend", () => {
      arrastando = null;
      limparMarcas();
      raiz.querySelectorAll(".arrastando").forEach(x => x.classList.remove("arrastando"));
    });

    // ---------- Janelinha da data de postagem ----------
    const cancelarPostado = () => {
      const p = estado.pendentePostado;
      if (p && p.sel){ p.sel.value = p.anterior; }
      estado.pendentePostado = null;
      $("cronModalPostado").classList.add("oculto");
    };
    $("cronPostadoCancelar").addEventListener("click", cancelarPostado);
    $("cronPostadoFechar").addEventListener("click", cancelarPostado);
    $("cronPostadoConfirmar").addEventListener("click", async () => {
      const p = estado.pendentePostado;
      const data = $("cronDataPostagemCampo").value;
      if (!p) return;
      if (!data){ alert("Escolha a data em que foi postado."); return; }
      estado.pendentePostado = null;
      $("cronModalPostado").classList.add("oculto");
      await salvar(p.id, { status: "Postado", data_postagem: data });
    });

    // ---------- Janela de nova ideia ----------
    const fecharNova = () => $("cronModalNova").classList.add("oculto");
    $("cronNovaFechar").addEventListener("click", fecharNova);
    $("cronNovaCancelar").addEventListener("click", fecharNova);
    $("cronNovaSalvar").addEventListener("click", salvarNova);

    // Troca entre linhas (computador) e cartões (celular) quando a tela muda de tamanho
    window.matchMedia("(max-width: 700px)").addEventListener("change", () => { if (estado.carregado) renderizarLista(); });
  }

  ligarEventos();
  window.carregarCronograma = () => carregar(false);

  // Se a sub-aba já estiver visível quando este arquivo carregar
  const secao = $("igSubCronograma");
  const abaIg = $("painelInstagram");
  if (secao && abaIg && !secao.classList.contains("oculto") && !abaIg.classList.contains("oculto")) carregar(false);
})();
