// js/auto-update.js
//
// Evita ficar presa numa versão antiga da página guardada em cache — comum quando o
// painel é instalado na tela de início do celular (PWA), principalmente no iPhone, que às
// vezes demora a perceber sozinho que existe uma versão nova publicada.
//
// Como funciona: document.lastModified sempre reflete a data que o SERVIDOR mandou junto
// com a cópia que está carregada agora na tela, mesmo que essa cópia tenha vindo de um
// cache antigo. Comparamos isso com uma checagem fresca (cache:"no-store", que ignora
// qualquer cache do navegador) pra saber se o arquivo publicado é mais novo do que o que
// está na tela agora.
//
// Se a checagem acontece logo que a página abre, ainda não tem nada em andamento pra
// perder — atualiza sozinho, sem perguntar. Se acontece com o app já em uso (checagem
// periódica ou ao voltar pro app depois de um tempo em segundo plano), só mostra um aviso
// discreto, pra não interromper o que ela estiver fazendo no meio.
(function(){
  const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000; // 5 minutos
  let avisoJaMostrado = false;

  async function versaoServidorMaisNova(){
    try {
      const resposta = await fetch(location.pathname, { method: "HEAD", cache: "no-store" });
      const ultimaModServidor = resposta.headers.get("last-modified");
      if (!ultimaModServidor) return false;
      return new Date(ultimaModServidor) > new Date(document.lastModified);
    } catch (erro) {
      return false; // sem internet ou falha na checagem: tenta de novo na próxima vez
    }
  }

  // Query string única de propósito: garante que o navegador (e qualquer cache no meio do
  // caminho) trate isso como uma URL nova, em vez de reaproveitar alguma cópia guardada.
  function aplicarAtualizacao(){
    const url = new URL(location.href);
    url.searchParams.set("_v", Date.now());
    location.href = url.toString();
  }

  function mostrarAvisoNovaVersao(){
    if (avisoJaMostrado || document.getElementById("avisoNovaVersaoApp")) return;
    avisoJaMostrado = true;

    const estilo = document.createElement("style");
    estilo.textContent = `
      #avisoNovaVersaoApp{
        position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 99999;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        background: var(--coral, #000080); color: #fff;
        padding: 12px 16px; border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        font-family: 'Outfit', sans-serif; font-size: .88rem;
      }
      #avisoNovaVersaoApp button{
        background: #fff; color: var(--coral, #000080); border: none;
        padding: 8px 14px; border-radius: 10px; font-weight: 600; cursor: pointer;
        font-family: 'Outfit', sans-serif; font-size: .85rem; flex-shrink: 0;
      }
    `;
    document.head.appendChild(estilo);

    const aviso = document.createElement("div");
    aviso.id = "avisoNovaVersaoApp";
    aviso.innerHTML = `<span>🔄 Nova versão disponível</span><button type="button">Atualizar agora</button>`;
    document.body.appendChild(aviso);
    aviso.querySelector("button").addEventListener("click", aplicarAtualizacao);
  }

  async function checarNovaVersao(motivo){
    if (!(await versaoServidorMaisNova())) return;
    if (motivo === "abertura") aplicarAtualizacao();
    else mostrarAvisoNovaVersao();
  }

  checarNovaVersao("abertura");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checarNovaVersao("uso");
  });
  setInterval(() => checarNovaVersao("uso"), INTERVALO_CHECAGEM_MS);
})();
