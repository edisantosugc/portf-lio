/* =========================================================================
   ADMINISTRATIVO > SEGURANÇA
   Lista de tentativas de acesso ao painel (login errado / recuperação de
   senha com e-mail sem acesso) + liga/desliga do aviso no celular.
   Quem grava é a função registrar_tentativa_acesso (ver
   seguranca_tentativas_acesso.sql), chamada pela página de login.
   Só a dona lê (RLS).
   ========================================================================= */
(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const POR_PAGINA = 50;
  const estado = { carregado: false, carregando: false, itens: [], ligados: true, filtro: "todas", mostrar: POR_PAGINA, erro: false };

  const doisDig = (n) => String(n).padStart(2, "0");
  function dataHora(iso){
    const d = new Date(iso);
    return `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)} · ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
  }
  const ROTULOS_TIPO = { login: "Login do painel", recuperar: "Recuperar senha", portal: "Portal (código)", conector: "Conectar Claude", demo: "Demonstração" };
  const rotuloTipo = (t) => ROTULOS_TIPO[t] || "Login";
  const etqQuem = (q) => q === "voce" ? `<span class="seg-etq voce">Seu e-mail</span>` : `<span class="seg-etq fora">De fora</span>`;
  const emailExibido = (it) => it.quem === "voce" ? "seu e-mail" : (it.email || (it.tipo === "portal" ? "código do Portal" : "(sem e-mail)"));

  async function carregar(forcar){
    const area = $("adminSeguranca");
    if (!area || estado.carregando) return;
    if (estado.carregado && !forcar){ renderizar(); return; }
    estado.carregando = true;
    area.innerHTML = `<div class="cartao"><p class="texto-vazio">Carregando…</p></div>`;
    try {
      const [lista, config] = await Promise.all([
        Auth.client.from("seguranca_tentativas").select("*").order("created_at", { ascending: false }).limit(1000),
        Auth.client.from("seguranca_config").select("avisos_ligados").eq("id", true).maybeSingle()
      ]);
      if (lista.error) throw lista.error;
      estado.itens = lista.data || [];
      estado.ligados = config.data ? config.data.avisos_ligados !== false : true;
      estado.erro = false;
      estado.carregado = true;
    } catch (erro) {
      console.error("Segurança: erro ao carregar", erro);
      estado.erro = true;
    } finally {
      estado.carregando = false;
    }
    renderizar();
  }

  function renderizar(){
    const area = $("adminSeguranca");
    if (!area) return;
    if (estado.erro){
      area.innerHTML = `<div class="cartao"><p class="texto-vazio">Não deu pra carregar as tentativas agora. <button type="button" class="btn-fantasma" data-seg="recarregar">Tentar de novo</button></p></div>`;
      return;
    }
    const seteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentes = estado.itens.filter(it => new Date(it.created_at).getTime() >= seteDias);
    const foraSemana = recentes.filter(it => it.quem === "fora").length;
    const minhasSemana = recentes.filter(it => it.quem === "voce").length;
    const ultimaFora = estado.itens.find(it => it.quem === "fora");

    const filtrados = estado.itens.filter(it => estado.filtro === "todas" || (estado.filtro === "fora" ? it.quem === "fora" : it.quem === "voce"));
    const visiveis = filtrados.slice(0, estado.mostrar);

    const linhas = visiveis.map(it => `
      <tr>
        <td>${esc(dataHora(it.created_at))}</td>
        <td class="seg-email">${esc(emailExibido(it))}</td>
        <td><span class="seg-etq tipo">${rotuloTipo(it.tipo)}</span></td>
        <td>${esc(it.aparelho || "—")}</td>
        <td>${etqQuem(it.quem)}</td>
      </tr>`).join("");
    const cartoes = visiveis.map(it => `
      <div class="seg-cartao">
        <div class="seg-cartao-topo">${etqQuem(it.quem)}<span class="seg-cartao-data">${esc(dataHora(it.created_at))}</span></div>
        <div class="seg-email">${esc(emailExibido(it))}</div>
        <div class="seg-cartao-aparelho">${rotuloTipo(it.tipo)}${it.aparelho ? " · " + esc(it.aparelho) : ""}</div>
      </div>`).join("");

    const vazio = estado.filtro === "todas" ? "Nenhuma tentativa de acesso registrada. 🎉" : estado.filtro === "fora" ? "Ninguém de fora tentou acessar." : "Nenhum erro de senha seu registrado.";

    area.innerHTML = `
      <div class="cartao">
        <h2 style="margin-bottom:12px;">Tentativas de acesso</h2>
        <div class="seg-resumo">
          <div class="seg-resumo-item${foraSemana ? " alerta" : ""}"><b>${foraSemana}</b><span>de fora nos últimos 7 dias</span></div>
          <div class="seg-resumo-item"><b>${minhasSemana}</b><span>${minhasSemana === 1 ? "erro de senha seu" : "erros de senha seus"} nos últimos 7 dias</span></div>
          <div class="seg-resumo-item"><b>${ultimaFora ? esc(dataHora(ultimaFora.created_at)) : "—"}</b><span>última tentativa de fora</span></div>
        </div>
        <div class="seg-config">
          <button type="button" class="seg-chave" role="switch" aria-checked="${estado.ligados}" data-seg="alternar-avisos"><i></i> Avisar no celular quando alguém tentar acessar</button>
          <small>Os avisos usam as notificações que você já ativou no painel.</small>
        </div>
      </div>
      <div class="cartao" style="margin-top:16px;">
        <div class="seg-topo-lista">
          <h2 style="font-size:1.05rem;">Histórico</h2>
          <div class="seg-filtros">
            ${[["todas", "Todas"], ["fora", "De fora"], ["minhas", "Minhas"]].map(([v, r]) => `<button type="button" class="${estado.filtro === v ? "ativo" : ""}" data-seg="filtro" data-filtro="${v}">${r}</button>`).join("")}
          </div>
        </div>
        ${visiveis.length ? `
          <div style="overflow-x:auto;">
            <table class="seg-tabela">
              <thead><tr><th>Quando</th><th>E-mail usado</th><th>O que tentou</th><th>Aparelho</th><th>Quem</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>
          <div class="seg-cartoes">${cartoes}</div>
          ${filtrados.length > visiveis.length ? `<div class="seg-mais"><button type="button" class="btn-fantasma" data-seg="mais">Mostrar mais (${filtrados.length - visiveis.length})</button></div>` : ""}
        ` : `<p class="texto-vazio">${vazio}</p>`}
      </div>`;
  }

  async function alternarAvisos(botao){
    const novo = !estado.ligados;
    botao.disabled = true;
    const { data, error } = await Auth.client.from("seguranca_config").update({ avisos_ligados: novo }).eq("id", true).select();
    botao.disabled = false;
    if (error || !data || !data.length){
      console.error("Segurança: erro ao salvar aviso", error);
      alert("Não deu pra salvar agora. Tenta de novo.");
      return;
    }
    estado.ligados = novo;
    renderizar();
  }

  function ligarEventos(){
    const area = $("adminSeguranca");
    if (!area) return;
    area.addEventListener("click", (e) => {
      const el = e.target.closest("[data-seg]");
      if (!el) return;
      const acao = el.dataset.seg;
      if (acao === "filtro"){ estado.filtro = el.dataset.filtro; estado.mostrar = POR_PAGINA; renderizar(); }
      else if (acao === "mais"){ estado.mostrar += POR_PAGINA; renderizar(); }
      else if (acao === "alternar-avisos") alternarAvisos(el);
      else if (acao === "recarregar") carregar(true);
    });
  }

  ligarEventos();

  // Chamado ao abrir a sub-aba (trocarSubAbaAdministrativo no painel.html). Sempre busca de novo.
  window.carregarSeguranca = () => carregar(true);

  // Se a sub-aba já estiver aberta antes deste arquivo carregar (ex.: veio da notificação)
  const area = $("adminSeguranca");
  if (area && area.classList.contains("ativo")) carregar(true);
})();
