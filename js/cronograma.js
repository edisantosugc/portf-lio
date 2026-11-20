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
  const ROBO_IG = "ig-metricas-cronograma";
  // O que o Instagram NÃO entrega (fica manual e conta como pendente até digitar)
  const MANUAIS = { REELS: ["nao_seguidores_pct", "seguidores_ganhos"], FEED: ["nao_seguidores_pct"] };
  // Não existe pra foto/carrossel (não conta como pendente)
  const NAO_SE_APLICA = { REELS: [], FEED: ["tempo_medio_seg", "taxa_pulo_pct"] };

  const DIAS_FIXOS = ["Extra", "Stories"];          // não mudam sozinhos quando escolhe a data
  const NOMES_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const ABREV_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const CHAVE_VISAO = "cronograma_visao";            // em assistente_config (vale no computador e no celular)

  const estado = {
    carregado: false, carregando: false,
    itens: [],
    lista: "Grade",
    visao: "ordem",              // "ordem" (Minha ordem) ou "data" (Por data)
    filtroPeriodo: "",           // "", "esta", "proxima", "sem"
    semanasAbertas: null,        // sanfona do celular na visão Por data (null = só a semana atual)
    semanaFoco: null,            // semana em que as setas ‹ › estão
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

  // ---------- Datas ----------
  function partesData(iso){ const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return { a, m, d, data: new Date(a, m - 1, d) }; }
  const isoDe = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const diaDaData = (iso) => NOMES_SEMANA[partesData(iso).data.getDay()];
  // "23/11 · seg" (com o ano se não for o ano atual: "05/01/27 · ter")
  function dataCurtaDia(iso){
    if (!iso) return "";
    const { a, m, d, data } = partesData(iso);
    const ano = a === new Date().getFullYear() ? "" : `/${String(a).slice(2)}`;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}${ano} · ${ABREV_SEMANA[data.getDay()]}`;
  }
  function inicioSemana(iso){                         // segunda-feira da semana (seg a dom)
    const { data } = partesData(iso);
    const volta = (data.getDay() + 6) % 7;
    data.setDate(data.getDate() - volta);
    return isoDe(data);
  }
  function somarDias(iso, n){ const { data } = partesData(iso); data.setDate(data.getDate() + n); return isoDe(data); }
  const ddmm = (iso) => { const { m, d } = partesData(iso); return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`; };
  const diaCombina = (it) => !it.data_prevista || DIAS_FIXOS.includes(it.dia) || it.dia === diaDaData(it.data_prevista);
  const atrasada = (it) => it.lista === "Grade" && it.data_prevista && it.data_prevista < hojeISO() && !["Postado", "Descartado"].includes(it.status);

  const semMetricas = (it) => METRICAS.every(m => it[m.campo] === null || it[m.campo] === undefined);
  // Pendente (48h depois): sem post ligado, OU falta algo que o Instagram não entrega e ela ainda não digitou
  const precisaLigarPost = (it) => it.lista === "Postados" && it.data_postagem && diasDesde(it.data_postagem) >= 2 && !it.ig_media_id;
  const metricasPendentes = (it) => {
    if (it.lista !== "Postados" || !it.data_postagem || diasDesde(it.data_postagem) < 2) return false;
    if (!it.ig_media_id) return true;
    return MANUAIS[it.ig_tipo || "REELS"].some(c => it[c] === null || it[c] === undefined);
  };
  const textoPendente = (it) => precisaLigarPost(it) ? "🔗 ligar post" : "⏳ métricas pendentes";
  const origemDe = (it, campo) => (it.metricas_origem || {})[campo] || "";
  const permalinkSeguro = (u) => /^https:\/\/(www\.)?instagram\.com\//i.test(String(u || "")) ? String(u) : "";
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
      await carregarVisao();
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

  // Última visão usada (Minha ordem / Por data), salva em assistente_config
  async function carregarVisao(){
    try {
      const { data, error } = await Auth.client.from("assistente_config").select("valor").eq("chave", CHAVE_VISAO).maybeSingle();
      if (!error && data && data.valor && ["ordem", "data"].includes(data.valor.visao)) estado.visao = data.valor.visao;
    } catch (e) { /* sem preferência: Minha ordem */ }
  }
  function salvarVisao(){
    Auth.client.from("assistente_config").upsert({ chave: CHAVE_VISAO, valor: { visao: estado.visao } }, { onConflict: "chave" })
      .then(({ error }) => { if (error) console.error("Cronograma: erro ao salvar visão", error); });
  }

  // Grava a data prevista; o Dia acompanha a data (menos Extra e Stories)
  async function salvarDataPrevista(id, iso){
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    const campos = { data_prevista: iso || null };
    if (iso && !DIAS_FIXOS.includes(it.dia)) campos.dia = diaDaData(iso);
    await salvar(id, campos);
  }

  /* --------------------------- Listas visíveis --------------------------- */
  const gradeOrdenada = () => estado.itens.filter(x => x.lista === "Grade").sort((a, b) => a.posicao - b.posicao);

  // "Minha ordem": ideias COM data no topo, em ordem de data (se ajusta sozinho);
  // ideias SEM data embaixo, na ordem que ela arrasta. Só muda a exibição — a posição
  // salva (posicao) de nenhuma ideia é alterada por isso.
  const gradeDatasPrimeiro = () => gradeOrdenada().sort((a, b) => {
    if (!!a.data_prevista !== !!b.data_prevista) return a.data_prevista ? -1 : 1;
    if (a.data_prevista) return a.data_prevista.localeCompare(b.data_prevista) || a.posicao - b.posicao;
    return a.posicao - b.posicao;
  });

  function itensVisiveis(){
    let lista = estado.lista === "Grade"
      ? gradeDatasPrimeiro()
      : estado.itens.filter(x => x.lista === "Postados").sort((a, b) =>
          String(b.data_postagem || "").localeCompare(String(a.data_postagem || "")) || String(b.created_at).localeCompare(String(a.created_at)));
    if (estado.filtroStatus) lista = lista.filter(x => x.status === estado.filtroStatus);
    else if (!estado.mostrarDescartados) lista = lista.filter(x => x.status !== "Descartado");
    if (estado.filtroDia) lista = lista.filter(x => x.dia === estado.filtroDia);
    if (estado.filtroPeriodo){
      // Na Grade vale a data prevista; em Postados, a data de postagem
      const campo = estado.lista === "Grade" ? "data_prevista" : "data_postagem";
      const seg = inicioSemana(hojeISO());
      const [ini, fim] = estado.filtroPeriodo === "esta" ? [seg, somarDias(seg, 6)] : [somarDias(seg, 7), somarDias(seg, 13)];
      lista = estado.filtroPeriodo === "sem"
        ? lista.filter(x => !x[campo])
        : lista.filter(x => x[campo] && x[campo] >= ini && x[campo] <= fim);
    }
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

    // Aviso geral se a conexão com o Instagram caiu (sem apagar nada do que já está preenchido)
    const erroConexao = estado.itens.map(x => x.metricas_erro).find(m => m && /conexão/i.test(m));
    raiz.innerHTML = `
      ${erroConexao ? `<div class="cron-aviso-conexao">⚠️ ${esc(erroConexao)} Os números novos voltam a chegar quando a conexão for refeita.</div>` : ""}
      <div class="cron-topo">
        <div class="ig-subabas-mini cron-listas">
          <button type="button" class="sub-aba-btn${estado.lista === "Grade" ? " ativo" : ""}" data-cron="lista" data-lista="Grade">Grade <span class="contagem-subaba">${nGrade}</span></button>
          <button type="button" class="sub-aba-btn${estado.lista === "Postados" ? " ativo" : ""}" data-cron="lista" data-lista="Postados">Postados <span class="contagem-subaba">${nPostados}</span>${nPendentes ? ` <span class="cron-badge-pendente" title="Itens com métricas pendentes">⏳ ${nPendentes}</span>` : ""}</button>
        </div>
        ${estado.lista === "Grade" ? `
        <div class="ig-subabas-mini cron-visoes" role="group" aria-label="Jeito de ver a Grade">
          <button type="button" class="sub-aba-btn${estado.visao === "ordem" ? " ativo" : ""}" data-cron="visao" data-visao="ordem">Minha ordem</button>
          <button type="button" class="sub-aba-btn${estado.visao === "data" ? " ativo" : ""}" data-cron="visao" data-visao="data">Por data</button>
        </div>` : ""}
        <button type="button" class="botao-add-tarefa" data-cron="nova">+ Nova ideia</button>
      </div>
      <div class="cron-filtros">
        <label>Período
          <select data-cron="filtro-periodo">
            <option value="">Todos</option>
            <option value="esta"${estado.filtroPeriodo === "esta" ? " selected" : ""}>Esta semana</option>
            <option value="proxima"${estado.filtroPeriodo === "proxima" ? " selected" : ""}>Próxima semana</option>
            <option value="sem"${estado.filtroPeriodo === "sem" ? " selected" : ""}>Sem data</option>
          </select>
        </label>
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
    const porData = estado.lista === "Grade" && estado.visao === "data";
    if (!lista.length && !porData){
      alvo.innerHTML = `<p class="cron-vazio">${estado.busca || estado.filtroDia || estado.filtroStatus || estado.filtroPeriodo ? "Nada encontrado com esses filtros." : estado.lista === "Grade" ? "Nenhuma ideia na Grade ainda." : "Nenhum post ainda."}</p>`;
      return;
    }
    if (porData){ alvo.innerHTML = visaoPorData(lista); return; }
    alvo.innerHTML = celular()
      ? lista.map((it, i) => (estado.lista === "Grade" && !it.data_prevista && i > 0 && lista[i - 1].data_prevista
          ? `<div class="cron-divisoria-sem-data">Sem data · use ↑↓ pra organizar</div>` : "") + cartaoCelular(it)).join("")
      : tabelaComputador(lista);
  }

  // ---------- Visão "Por data": semanas empilhadas (seg a dom) + "Sem data" no fim ----------
  function gruposPorSemana(lista){
    const estaSemana = inicioSemana(hojeISO());
    const mapa = new Map();
    lista.filter(x => x.data_prevista).forEach(x => {
      const k = inicioSemana(x.data_prevista);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(x);
    });
    if (!estado.filtroPeriodo && !mapa.has(estaSemana)) mapa.set(estaSemana, []);   // esta semana sempre aparece
    const grupos = [...mapa.keys()].sort().map(k => ({
      chave: k,
      titulo: `Semana de ${ddmm(k)} a ${ddmm(somarDias(k, 6))}`,
      etiqueta: k === estaSemana ? "esta semana" : k === somarDias(estaSemana, 7) ? "próxima semana" : k < estaSemana ? "passada" : "",
      itens: mapa.get(k).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista) || a.posicao - b.posicao)
    }));
    const semData = lista.filter(x => !x.data_prevista);
    if (semData.length) grupos.push({ chave: "sem-data", titulo: "Sem data", etiqueta: "", itens: semData });
    return grupos;
  }

  function visaoPorData(lista){
    const grupos = gruposPorSemana(lista);
    const estaSemana = inicioSemana(hojeISO());
    if (!estado.semanasAbertas) estado.semanasAbertas = new Set([estaSemana]);
    if (!estado.semanaFoco || !grupos.some(g => g.chave === estado.semanaFoco)) estado.semanaFoco = grupos.some(g => g.chave === estaSemana) ? estaSemana : (grupos[0] && grupos[0].chave);
    const noCelular = celular();
    const navegacao = `
      <div class="cron-semanas-nav">
        <button type="button" data-cron="semana-anterior" aria-label="Semana anterior">‹</button>
        <button type="button" class="btn-fantasma" data-cron="semana-atual">Esta semana</button>
        <button type="button" data-cron="semana-proxima" aria-label="Próxima semana">›</button>
        <span class="cron-dica">Nesta visão a ordem é pela data. Pra arrastar, use "Minha ordem".</span>
      </div>`;
    if (!grupos.length) return navegacao + `<p class="cron-vazio">Nada encontrado com esses filtros.</p>`;
    return navegacao + grupos.map(g => {
      const aberto = !noCelular || estado.semanasAbertas.has(g.chave);
      const corpo = g.itens.length
        ? (noCelular ? g.itens.map(cartaoCelular).join("") : tabelaComputador(g.itens))
        : `<p class="cron-vazio">Nenhuma ideia nesta semana.</p>`;
      return `
        <section class="cron-semana${aberto ? " aberta" : ""}${g.chave === estado.semanaFoco ? " foco" : ""}" id="cronSemana-${g.chave}">
          <button type="button" class="cron-semana-titulo" data-cron="semana-alternar" data-semana="${g.chave}" aria-expanded="${aberto}">
            <span>${esc(g.titulo)}</span>
            <span class="contagem-subaba">${g.itens.length}</span>
            ${g.etiqueta ? `<span class="cron-semana-etiqueta ${g.etiqueta === "passada" ? "passada" : ""}">${esc(g.etiqueta)}</span>` : ""}
            <span class="cron-semana-seta" aria-hidden="true">▾</span>
          </button>
          ${aberto ? `<div class="cron-semana-corpo">${corpo}</div>` : ""}
        </section>`;
    }).join("");
  }

  function irParaSemana(direcao){
    if (!estado.semanasAbertas) estado.semanasAbertas = new Set();
    const grupos = gruposPorSemana(itensVisiveis());
    if (!grupos.length) return;
    let i = grupos.findIndex(g => g.chave === estado.semanaFoco);
    if (direcao === "atual"){
      const k = inicioSemana(hojeISO());
      i = grupos.findIndex(g => g.chave === k);
      if (i < 0) i = 0;
    } else {
      i = Math.min(grupos.length - 1, Math.max(0, i + (direcao === "proxima" ? 1 : -1)));
    }
    estado.semanaFoco = grupos[i].chave;
    estado.semanasAbertas.add(estado.semanaFoco);
    renderizarLista();
    const el = $(`cronSemana-${estado.semanaFoco}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Célula de data (data prevista na Grade / data de postagem em Postados): "23/11 · seg"
  function celulaData(it){
    const campo = it.lista === "Postados" ? "data_postagem" : "data_prevista";
    const valor = it[campo];
    return `<button type="button" class="cron-data-btn${valor ? "" : " vazia"}" data-cron="editar-data" data-campo="${campo}" data-id="${it.id}" title="${campo === "data_postagem" ? "Data de postagem" : "Data prevista"} — clique pra escolher">${valor ? esc(dataCurtaDia(valor)) : "+ data"}</button>`;
  }

  function avisosData(it){
    let h = "";
    if (atrasada(it)) h += `<span class="cron-badge-atrasada" title="A data prevista já passou e ainda não foi postado">⏰ atrasada</span>`;
    if (it.lista === "Grade" && !diaCombina(it)) h += `<span class="cron-badge-dia" title="O Dia escolhido não bate com a data prevista">⚠ dia ≠ data</span>`;
    return h;
  }

  function editarData(btn){
    const id = btn.dataset.id, campo = btn.dataset.campo;
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    const input = document.createElement("input");
    input.type = "date"; input.className = "cron-data"; input.value = it[campo] || "";
    btn.replaceWith(input);
    input.focus();
    try { input.showPicker(); } catch (e) { /* navegador sem calendário automático: a pessoa clica no campo */ }
    let terminou = false;
    const fim = async () => {
      if (terminou) return; terminou = true;
      const novo = input.value;
      if (novo === (it[campo] || "")) { renderizarLista(); return; }
      if (campo === "data_postagem"){
        if (!novo){ alert("A data de postagem não pode ficar vazia."); renderizarLista(); return; }
        await salvar(id, { data_postagem: novo });
      } else {
        await salvarDataPrevista(id, novo);
      }
    };
    input.addEventListener("change", fim);
    input.addEventListener("blur", () => setTimeout(fim, 150));
    input.addEventListener("keydown", (e) => { if (e.key === "Escape"){ terminou = true; renderizarLista(); } });
  }

  // ---------- Computador: linhas finas ----------
  function tabelaComputador(lista){
    const postados = estado.lista === "Postados";
    const podeArrastar = !postados && estado.visao === "ordem";
    return `
      <div class="cron-tabela${postados ? " postados" : ""}">
        <div class="cron-linha cron-cabecalho">
          <span></span><span>${postados ? "Postado em" : "Data"}</span><span>Dia</span><span>Tema</span><span>Ideia</span><span>Formato</span><span>Status</span><span>Observações</span>
        </div>
        ${lista.map((it, i) => {
          const aberto = estado.abertos.has(it.id);
          // Na "Minha ordem", só as ideias SEM data são arrastáveis (as com data seguem a data)
          const arrasta = podeArrastar && !it.data_prevista;
          const divisoria = podeArrastar && !it.data_prevista && i > 0 && lista[i - 1].data_prevista
            ? `<div class="cron-divisoria-sem-data">Sem data · arraste pra organizar</div>` : "";
          return `${divisoria}
          <div class="cron-bloco${it.status === "Descartado" ? " descartado" : ""}${aberto ? " aberto" : ""}" data-id="${it.id}"${arrasta ? ` data-arrastavel="1"` : ""}>
            <div class="cron-linha">
              <span class="cron-alca"${arrasta ? ` draggable="true" title="Arraste pra mudar a ordem"` : (podeArrastar ? ` title="Ideias com data ficam em ordem de data"` : "")}>${arrasta ? "⋮⋮" : ""}</span>
              ${celulaData(it)}
              <select class="cron-pilula" style="${estiloPilula(corDia(it.dia))}" data-cron="campo-select" data-campo="dia" data-id="${it.id}" aria-label="Dia">${opcoesHtml(DIAS, it.dia)}</select>
              <span class="cron-texto" data-cron="editar-texto" data-campo="tema" data-id="${it.id}" title="${esc(it.tema)}">${esc(it.tema) || '<span class="cron-placeholder">—</span>'}</span>
              <span class="cron-texto cron-ideia" data-cron="editar-texto" data-campo="ideia" data-id="${it.id}" title="${esc(it.ideia)}">${esc(it.ideia) || '<span class="cron-placeholder">—</span>'}</span>
              <span class="cron-texto" data-cron="editar-texto" data-campo="formato" data-id="${it.id}" title="${esc(it.formato)}">${esc(it.formato) || '<span class="cron-placeholder">—</span>'}</span>
              <select class="cron-pilula" style="${estiloPilula(corStatus(it.status))}" data-cron="campo-select" data-campo="status" data-id="${it.id}" aria-label="Status">${opcoesHtml(STATUS, it.status)}</select>
              <span class="cron-obs-celula">
                ${iconeRoteiro(it)}
                ${avisosData(it)}
                <button type="button" class="cron-ver-mais" data-cron="alternar" data-id="${it.id}">${aberto ? "▾ fechar" : it.observacoes ? "▸ ver mais" : "▸ abrir"}</button>
                ${precisaLigarPost(it)
                  ? `<button type="button" class="cron-badge-pendente cron-badge-botao" data-cron="ligar-post" data-id="${it.id}" title="Clique pra escolher o post do Instagram">🔗 ligar post</button>`
                  : metricasPendentes(it) ? `<span class="cron-badge-pendente" title="Falta digitar o que o Instagram não entrega">${textoPendente(it)}</span>` : ""}
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
    const setas = grade && estado.visao === "ordem" && !it.data_prevista;
    const dataItem = grade ? it.data_prevista : it.data_postagem;
    return `
      <div class="cron-cartao${it.status === "Descartado" ? " descartado" : ""}${aberto ? " aberto" : ""}" data-id="${it.id}">
        <div class="cron-cartao-topo">
          <button type="button" class="cron-cartao-resumo" data-cron="alternar" data-id="${it.id}" aria-expanded="${aberto}">
            ${dataItem ? `<span class="cron-data-curta">${esc(ddmm(dataItem))}</span>` : ""}
            <span class="cron-pilula-fixa" style="${estiloPilula(corDia(it.dia))}">${esc(it.dia)}</span>
            <span class="cron-cartao-ideia">${esc(it.ideia) || "—"}</span>
            ${linkSeguro(it.link_roteiro) ? `<span class="cron-tem-link" title="Tem link do roteiro">📄</span>` : ""}
            <span class="cron-pilula-fixa" style="${estiloPilula(corStatus(it.status))}">${esc(it.status)}</span>
            ${metricasPendentes(it) ? `<span class="cron-badge-pendente">${precisaLigarPost(it) ? "🔗" : "⏳"}</span>` : ""}
            ${atrasada(it) ? `<span class="cron-badge-atrasada" title="Atrasada">⏰</span>` : ""}
            ${grade && !diaCombina(it) ? `<span class="cron-badge-dia" title="Dia ≠ data">⚠</span>` : ""}
          </button>
          ${setas ? `<span class="cron-setas">
            <button type="button" data-cron="subir" data-id="${it.id}" aria-label="Subir">↑</button>
            <button type="button" data-cron="descer" data-id="${it.id}" aria-label="Descer">↓</button>
          </span>` : ""}
        </div>
        ${aberto ? `
          ${avisosData(it) ? `<div class="cron-cartao-avisos">${avisosData(it)}</div>` : ""}
          <div class="cron-cartao-campos">
            ${grade ? `<label class="cron-campo-largo">Data prevista<input type="date" value="${esc(it.data_prevista || "")}" data-cron="data-prevista" data-id="${it.id}"></label>` : ""}
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
           <button type="button" class="btn-fantasma cron-excluir" data-cron="excluir" data-id="${it.id}" title="Apagar essa ideia de vez">🗑 Excluir ideia</button>
           ${it.observacoes ? `<button type="button" class="btn-fantasma" data-cron="obs-copiar" data-id="${it.id}">Copiar</button>` : ""}
           <button type="button" class="btn-fantasma" data-cron="obs-editar" data-id="${it.id}">Editar observações</button>
         </div>`;
    const tipo = it.ig_tipo || "REELS";
    const marca = (campo) => {
      const o = origemDe(it, campo);
      return o === "instagram" ? `<span class="cron-origem ig" title="Veio do Instagram">📷</span>`
        : o === "manual" ? `<span class="cron-origem manual" title="Você digitou">✍️</span>` : "";
    };
    const permalink = permalinkSeguro(it.ig_permalink);
    const blocoPost = it.lista !== "Postados" ? "" : `
      <div class="cron-post-ig">
        <div class="cron-detalhes-rotulo">Post do Instagram</div>
        ${it.ig_media_id ? `
          <div class="cron-post-ig-linha">
            <span>✅ Post ligado${it.ig_tipo ? ` (${it.ig_tipo === "REELS" ? "Reels" : "foto/carrossel"})` : ""}</span>
            ${permalink ? `<a class="btn-fantasma" href="${esc(permalink)}" target="_blank" rel="noopener noreferrer">Abrir no Instagram ↗</a>` : ""}
            <button type="button" class="btn-fantasma" data-cron="ligar-post" data-id="${it.id}">Trocar post</button>
            <button type="button" class="botao-add-tarefa" data-cron="metricas-ig-agora" data-id="${it.id}">📷 Atualizar métricas agora</button>
          </div>
          <div class="cron-sub-info">${it.metricas_atualizadas_em ? `Última atualização do Instagram: ${esc(new Date(it.metricas_atualizadas_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}` : "Ainda não buscou os números (busca sozinha 48h e 7 dias depois de postar, às 9h)."}</div>`
        : `<div class="cron-post-ig-linha">
            <span class="cron-placeholder">Nenhum post ligado ainda.</span>
            <button type="button" class="botao-add-tarefa" data-cron="ligar-post" data-id="${it.id}">🔗 Ligar post do Instagram</button>
          </div>`}
        ${it.metricas_erro ? `<div class="cron-erro-ig">⚠️ ${esc(it.metricas_erro)}</div>` : ""}
        <div class="cron-sub-info" id="cronIgStatus-${it.id}"></div>
      </div>`;
    const metricas = it.lista !== "Postados" ? "" : `
      ${blocoPost}
      <div class="cron-metricas">
        <div class="cron-metricas-titulo">Métricas (48h depois de postar)${metricasPendentes(it) ? ` <span class="cron-badge-pendente">${precisaLigarPost(it) ? "🔗 ligue o post" : "⏳ pendentes"}</span>` : ""}
          <span class="cron-legenda-origem">📷 veio do Instagram · ✍️ você digitou</span></div>
        <div class="cron-metricas-grade">
          ${METRICAS.map(m => {
            const naoAplica = it.ig_media_id && NAO_SE_APLICA[tipo].includes(m.campo);
            const manualPendente = it.ig_media_id && MANUAIS[tipo].includes(m.campo) && (it[m.campo] === null || it[m.campo] === undefined);
            return `<label class="${manualPendente ? "cron-falta" : ""}"><span class="cron-rotulo-metrica">${esc(m.rotulo)} ${marca(m.campo)}</span><input type="number" inputmode="decimal" min="0"${m.tipo === "pct" ? ` max="100"` : ""} step="${m.tipo === "int" ? "1" : "0.01"}" value="${naoAplica ? "" : (it[m.campo] ?? "")}" data-metrica="${m.campo}"${naoAplica ? ` disabled placeholder="não se aplica"` : manualPendente ? ` placeholder="digite à mão" title="Esse número não vem do Instagram"` : ""}></label>`;
          }).join("")}
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
      // Pede a data de postagem antes (já com a data prevista, ou hoje)
      estado.pendentePostado = { id, sel, anterior: it.status };
      $("cronDataPostagemCampo").value = it.data_prevista || hojeISO();
      $("cronModalPostado").classList.remove("oculto");
      $("cronDataPostagemCampo").focus();
      return;
    }
    sel.disabled = true;
    const salvo = await salvar(id, { [campo]: valor });
    // Mudou o Dia na mão e não bate com a data prevista: só pergunta, nada muda sozinho
    if (salvo && campo === "dia" && !diaCombina(salvo)){
      const diaData = diaDaData(salvo.data_prevista).toLowerCase();
      if (window.confirm(`A data ${ddmm(salvo.data_prevista)} é ${diaData}, mas o Dia agora é ${valor}. Quer limpar a data?`)){
        await salvar(id, { data_prevista: null });
      }
    }
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
    const visiveis = itensVisiveis().filter(x => !x.data_prevista);   // só entre as sem data
    const i = visiveis.findIndex(x => x.id === id);
    const vizinho = visiveis[direcao === "subir" ? i - 1 : i + 1];
    if (vizinho) moverPara(id, vizinho.id, direcao === "subir" ? "antes" : "depois");
  }

  async function salvarMetricas(id, botao){
    const caixa = botao.closest(".cron-metricas");
    const campos = {};
    for (const el of caixa.querySelectorAll("[data-metrica]")){
      const campo = el.dataset.metrica;
      if (el.disabled) continue;                       // "não se aplica": não mexe
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
    // O que ela mudou à mão vira "digitado" (✍️) e a busca automática nunca escreve por cima.
    // Se ela apagar um número, tira a marca, e o Instagram pode preencher de novo.
    const it = estado.itens.find(x => x.id === id);
    const origem = { ...((it && it.metricas_origem) || {}) };
    for (const m of METRICAS){
      if (!(m.campo in campos)) continue;
      const antes = it ? it[m.campo] : null;
      const depois = campos[m.campo];
      const igual = (antes === null || antes === undefined) ? depois === null : Number(antes) === depois;
      if (igual) continue;
      if (depois === null) delete origem[m.campo]; else origem[m.campo] = "manual";
    }
    campos.metricas_origem = origem;
    botao.disabled = true; botao.textContent = "Salvando…";
    const ok = await salvar(id, campos);
    const status = $(`cronMetricasStatus-${id}`);
    if (ok && status) status.textContent = "Salvo ✓";
  }

  /* ------------------------- Instagram: post e métricas ------------------------- */
  async function chamarRobo(corpo){
    const { data, error } = await Auth.client.functions.invoke(ROBO_IG, { body: corpo });
    if (error){
      let msg = "Não deu pra falar com o Instagram agora. Tenta de novo daqui a pouco.";
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return data;
  }

  async function recarregarItem(id){
    const { data } = await Auth.client.from(TABELA).select("*").eq("id", id).maybeSingle();
    if (data){ const i = estado.itens.findIndex(x => x.id === id); if (i >= 0) estado.itens[i] = data; }
    renderizar();
  }

  const ROTULO_METRICA = Object.fromEntries(METRICAS.map(m => [m.campo, m.rotulo]));

  async function atualizarMetricasIg(id, botao){
    if (botao){ botao.disabled = true; botao.textContent = "Buscando no Instagram…"; }
    try {
      const r = await chamarRobo({ acao: "atualizar", id });
      await recarregarItem(id);
      const st = $(`cronIgStatus-${id}`);
      if (st){
        st.textContent = r && r.ok
          ? (r.preenchidas && r.preenchidas.length ? `Vieram do Instagram: ${r.preenchidas.map(c => ROTULO_METRICA[c] || c).join(", ")}.` : "O Instagram ainda não entregou números novos (os digitados foram mantidos).")
          : (r && r.aviso) || "";
      }
    } catch (erro) {
      await recarregarItem(id);
      const st = $(`cronIgStatus-${id}`);
      if (st) st.textContent = "⚠️ " + erro.message;
    }
  }

  // Janela "Qual é esse post?" (lista os posts recentes do Instagram)
  let postsCache = null;
  async function abrirEscolherPost(id){
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    estado.escolhendoPost = { id, selecionado: it.ig_media_id || null };
    $("cronPostSub").textContent = it.data_postagem ? `Postado em ${dataCurtaDia(it.data_postagem)} · ${it.ideia || ""}` : (it.ideia || "");
    $("cronPostLista").innerHTML = `<p class="cron-vazio">Carregando seus posts do Instagram…</p>`;
    $("cronPostConfirmar").disabled = true;
    $("cronModalPost").classList.remove("oculto");
    try {
      if (!postsCache){ const r = await chamarRobo({ acao: "listar_posts" }); postsCache = r.posts || []; }
      const doDia = postsCache.filter(p => p.data_sp === it.data_postagem);
      if (!estado.escolhendoPost.selecionado && doDia.length === 1) estado.escolhendoPost.selecionado = doDia[0].id;
      renderizarPosts(it);
    } catch (erro) {
      $("cronPostLista").innerHTML = `<p class="cron-erro-ig">⚠️ ${esc(erro.message)}</p>`;
    }
  }

  function renderizarPosts(it){
    const sel = estado.escolhendoPost.selecionado;
    const doDia = new Set(postsCache.filter(p => p.data_sp === it.data_postagem).map(p => p.id));
    // os do dia da postagem primeiro
    const ordenados = [...postsCache].sort((a, b) => (doDia.has(b.id) ? 1 : 0) - (doDia.has(a.id) ? 1 : 0));
    $("cronPostLista").innerHTML = ordenados.length ? ordenados.map(p => `
      <button type="button" class="cron-post-opcao${p.id === sel ? " selecionado" : ""}" data-post="${esc(p.id)}">
        ${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="cron-post-sem-img">${p.tipo === "REELS" ? "🎬" : "🖼️"}</span>`}
        <span class="cron-post-info">
          <strong>${esc(p.data_sp ? dataCurtaDia(p.data_sp) : "")}${p.hora_sp ? ` · ${esc(p.hora_sp)}` : ""} · ${p.tipo === "REELS" ? "Reels" : "foto/carrossel"}${doDia.has(p.id) ? ` <span class="cron-sugerido">${doDia.size === 1 ? "sugerido" : "mesma data"}</span>` : ""}</strong>
          <span>${esc(p.legenda) || "(sem legenda)"}</span>
        </span>
      </button>`).join("") : `<p class="cron-vazio">Nenhum post encontrado no Instagram.</p>`;
    $("cronPostConfirmar").disabled = !sel;
  }

  async function confirmarPost(){
    const ep = estado.escolhendoPost;
    if (!ep || !ep.selecionado) return;
    const p = postsCache.find(x => x.id === ep.selecionado);
    const it = estado.itens.find(x => x.id === ep.id);
    $("cronModalPost").classList.add("oculto");
    estado.escolhendoPost = null;
    if (!p || !it) return;
    const trocou = it.ig_media_id && it.ig_media_id !== p.id;
    const campos = { ig_media_id: p.id, ig_tipo: p.tipo, ig_permalink: /^https:\/\//.test(p.link || "") ? p.link : null, metricas_erro: null };
    if (trocou){ campos.metricas_atualizadas_em = null; }
    const salvo = await salvar(it.id, campos);
    estado.abertos.add(it.id);
    renderizarLista();
    // Já passou 48h (ex.: post antigo)? Busca os números na hora.
    if (salvo && salvo.data_postagem && diasDesde(salvo.data_postagem) >= 2) atualizarMetricasIg(it.id, null);
  }

  /* ------------------------------ Excluir ideia ------------------------------ */
  // Apaga de verdade (só pelo painel; o conector continua sem poder apagar).
  // Pra só tirar da frente sem perder, o status "Descartado" continua existindo.
  async function excluirIdeia(id, botao){
    const it = estado.itens.find(x => x.id === id);
    if (!it) return;
    const nome = (it.ideia || it.tema || "essa ideia").slice(0, 80);
    if (!confirm(`Excluir "${nome}" de vez?\n\nNão dá pra desfazer. Se quiser só tirar da frente, use o status "Descartado".`)) return;
    botao.disabled = true; botao.textContent = "Excluindo…";
    let ok = false;
    try {
      const { data, error } = await Auth.client.from(TABELA).delete().eq("id", id).select("id");
      ok = !error && Array.isArray(data) && data.length === 1;   // 0 linhas = o banco não deixou apagar
      if (!ok) console.error("Cronograma: exclusão recusada", error || "nenhuma linha apagada");
    } catch (erro) { console.error("Cronograma: erro ao excluir", erro); }
    if (!ok){
      botao.disabled = false; botao.textContent = "🗑 Excluir ideia";
      alert("Não foi possível excluir agora. Tenta de novo.");
      return;
    }
    estado.itens = estado.itens.filter(x => x.id !== id);
    estado.abertos.delete(id);
    if (estado.editandoObs === id) estado.editandoObs = null;
    renderizar();
  }

  /* ------------------------------ Nova ideia ------------------------------ */
  function abrirNova(){
    $("cronNovaDia").innerHTML = opcoesHtml(DIAS, estado.filtroDia || "A definir");
    $("cronNovaStatus").innerHTML = opcoesHtml(STATUS.filter(s => s.nome !== "Postado"), "Sugestão (aprovar)");
    ["cronNovaTema", "cronNovaIdeia", "cronNovaFormato", "cronNovaObs", "cronNovaLink", "cronNovaData"].forEach(id => { $(id).value = ""; });
    $("cronModalNova").classList.remove("oculto");
    $("cronNovaIdeia").focus();
  }

  async function salvarNova(){
    const ideia = $("cronNovaIdeia").value;
    if (!ideia.trim()){ alert("Escreve a ideia."); $("cronNovaIdeia").focus(); return; }
    const vazioNulo = (v) => v.trim() === "" ? null : v;
    const link = $("cronNovaLink").value.trim();
    if (link && !linkSeguro(link)){ alert("O link do roteiro precisa começar com https://"); $("cronNovaLink").focus(); return; }
    const dataPrevista = $("cronNovaData").value || null;
    let dia = $("cronNovaDia").value;
    if (dataPrevista && !DIAS_FIXOS.includes(dia)) dia = diaDaData(dataPrevista);
    const linha = {
      link_roteiro: link || null,
      data_prevista: dataPrevista,
      dia,
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
      else if (acao === "visao"){
        if (estado.visao !== el.dataset.visao){ estado.visao = el.dataset.visao; salvarVisao(); renderizar(); }
      }
      else if (acao === "editar-data") editarData(el);
      else if (acao === "ligar-post") abrirEscolherPost(id);
      else if (acao === "metricas-ig-agora") atualizarMetricasIg(id, el);
      else if (acao === "semana-anterior") irParaSemana("anterior");
      else if (acao === "semana-proxima") irParaSemana("proxima");
      else if (acao === "semana-atual") irParaSemana("atual");
      else if (acao === "semana-alternar"){
        if (!celular()) return;     // no computador as semanas ficam sempre abertas
        const k = el.dataset.semana;
        estado.semanasAbertas.has(k) ? estado.semanasAbertas.delete(k) : estado.semanasAbertas.add(k);
        renderizarLista();
      }
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
      else if (acao === "excluir") excluirIdeia(id, el);
    });

    raiz.addEventListener("change", (e) => {
      const el = e.target;
      const acao = el.dataset.cron;
      if (acao === "campo-select") mudarCampoSelect(el);
      else if (acao === "filtro-dia"){ estado.filtroDia = el.value; renderizar(); }
      else if (acao === "filtro-periodo"){ estado.filtroPeriodo = el.value; renderizar(); }
      else if (acao === "data-prevista") salvarDataPrevista(el.dataset.id, el.value);
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
      const bloco = e.target.closest(".cron-bloco[data-arrastavel]");   // só solta entre ideias sem data
      if (!bloco || bloco.dataset.id === arrastando){ limparMarcas(); return; }
      e.preventDefault();
      const r = bloco.getBoundingClientRect();
      const antes = e.clientY < r.top + Math.min(r.height, 40) / 2;
      limparMarcas();
      bloco.classList.add(antes ? "solta-antes" : "solta-depois");
    });
    raiz.addEventListener("drop", (e) => {
      if (!arrastando) return;
      const bloco = e.target.closest(".cron-bloco[data-arrastavel]");
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
      const salvo = await salvar(p.id, { status: "Postado", data_postagem: data });
      if (salvo) abrirEscolherPost(p.id);      // em seguida: qual é esse post no Instagram?
    });

    // ---------- Janela "Qual é esse post?" ----------
    $("cronPostLista").addEventListener("click", (e) => {
      const b = e.target.closest(".cron-post-opcao");
      if (!b || !estado.escolhendoPost) return;
      estado.escolhendoPost.selecionado = b.dataset.post;
      const it = estado.itens.find(x => x.id === estado.escolhendoPost.id);
      if (it) renderizarPosts(it);
    });
    const fecharPost = () => { $("cronModalPost").classList.add("oculto"); estado.escolhendoPost = null; };
    $("cronPostCancelar").addEventListener("click", fecharPost);
    $("cronPostFechar").addEventListener("click", fecharPost);
    $("cronPostConfirmar").addEventListener("click", confirmarPost);

    // ---------- Janela de nova ideia ----------
    const fecharNova = () => $("cronModalNova").classList.add("oculto");
    $("cronNovaFechar").addEventListener("click", fecharNova);
    $("cronNovaCancelar").addEventListener("click", fecharNova);
    $("cronNovaSalvar").addEventListener("click", salvarNova);
    // Na janela de nova ideia, escolher a data já acerta o Dia (menos Extra e Stories)
    $("cronNovaData").addEventListener("change", () => {
      const v = $("cronNovaData").value;
      if (v && !DIAS_FIXOS.includes($("cronNovaDia").value)) $("cronNovaDia").value = diaDaData(v);
    });

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
