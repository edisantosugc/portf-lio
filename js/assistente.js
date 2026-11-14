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
  const STATUS_PENDENCIA = ["Pendente", "Em andamento", "Feito"];
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
    modal: null                // { tipo, id }
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

  // ---------- Pendências ----------
  function htmlPendencias(){
    let lista = estado.pendencias.slice();
    if (estado.filtroCategoria) lista = lista.filter(p => p.categoria === estado.filtroCategoria);
    if (estado.filtroStatus) lista = lista.filter(p => p.status === estado.filtroStatus);
    else if (!estado.mostrarFeitosPendencias) lista = lista.filter(p => p.status !== "Feito");

    lista.sort((a, b) =>
      (a.prioridade - b.prioridade) ||
      ((a.data_limite || "9999-12-31").localeCompare(b.data_limite || "9999-12-31")) ||
      String(b.created_at).localeCompare(String(a.created_at))
    );

    const qtdFeitos = estado.pendencias.filter(p => p.status === "Feito").length;

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
          <label class="assist-check"><input type="checkbox" data-acao="assist-mostrar-feitos" data-lista="pendencias"${estado.mostrarFeitosPendencias ? " checked" : ""}> Mostrar feitos (${qtdFeitos})</label>`}
      </div>
      <div class="assist-lista">
        ${lista.length ? lista.map(cardPendencia).join("") : `<p class="assist-vazio">Nenhuma pendência por aqui.</p>`}
      </div>
    `;
  }

  function cardPendencia(p){
    const prazo = p.data_limite ? rotuloPrazo(p.data_limite) : "";
    const atrasado = p.data_limite && p.status !== "Feito" && diasAte(p.data_limite) < 0;
    return `
      <div class="assist-card${p.status === "Feito" ? " feito" : ""}">
        <div class="assist-card-topo">
          <span class="assist-prio prio-${p.prioridade}" title="${esc(PRIORIDADES[p.prioridade])}">${p.prioridade} · ${esc(PRIORIDADES[p.prioridade])}</span>
          <span class="links-pill-categoria">${esc(p.categoria)}</span>
          ${prazo ? `<span class="assist-prazo${atrasado ? " atrasado" : ""}">📅 ${esc(prazo)}</span>` : ""}
        </div>
        <div class="assist-card-titulo">${esc(p.titulo)}</div>
        ${blocoTextoLongo(p.id, p.descricao, "descrição")}
        <div class="assist-card-rodape">
          <select class="assist-status" data-acao="assist-status" data-tabela="assistente_pendencias" data-id="${p.id}" aria-label="Status">${opcoes(STATUS_PENDENCIA, p.status)}</select>
          <button type="button" class="marcas-botao-icone" data-acao="assist-editar" data-tipo="pendencia" data-id="${p.id}" title="Editar">✎</button>
        </div>
      </div>
    `;
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
        { nome: "status", rotulo: "Status", tipo: "select", opcoes: STATUS_PENDENCIA, padrao: "Pendente" },
        { nome: "data_limite", rotulo: "Data limite (opcional)", tipo: "date" }
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

  async function mudarStatus(tabela, id, status, select){
    const nomeLista = { assistente_pendencias: "pendencias", assistente_indicacoes: "indicacoes", assistente_lembretes: "lembretes" }[tabela];
    const item = estado[nomeLista].find(x => x.id === id);
    if (!item) return;
    const anterior = item.status;
    select.disabled = true;
    const { data, error } = await Auth.client.from(tabela).update({ status }).eq("id", id).select();
    if (error || !data || !data.length){
      console.error("Assistente: erro ao mudar status", error);
      alert("Não deu pra mudar o status. Tenta de novo.");
      select.value = anterior;
      select.disabled = false;
      return;
    }
    Object.assign(item, data[0]);
    renderizar();
  }

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
      if (acao === "assist-novo") abrirModal(alvo.dataset.tipo);
      else if (acao === "assist-editar") abrirModal(alvo.dataset.tipo, alvo.dataset.id);
      else if (acao === "assist-alternar"){
        const id = alvo.dataset.id;
        estado.abertos.has(id) ? estado.abertos.delete(id) : estado.abertos.add(id);
        renderizar();
      }
    });
    conteudo.addEventListener("change", (e) => {
      const alvo = e.target.closest("[data-acao]");
      if (!alvo) return;
      const acao = alvo.dataset.acao;
      if (acao === "assist-status") mudarStatus(alvo.dataset.tabela, alvo.dataset.id, alvo.value, alvo);
      else if (acao === "assist-filtro-categoria"){ estado.filtroCategoria = alvo.value; renderizar(); }
      else if (acao === "assist-filtro-status"){ estado.filtroStatus = alvo.value; renderizar(); }
      else if (acao === "assist-mostrar-feitos"){
        if (alvo.dataset.lista === "pendencias") estado.mostrarFeitosPendencias = alvo.checked;
        else estado.mostrarFeitosLembretes = alvo.checked;
        renderizar();
      }
    });
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
