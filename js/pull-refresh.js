// js/pull-refresh.js
//
// Gesto de "puxar pra atualizar" no celular (igual Instagram): só ativa quando a página já
// está bem no topo (senão atrapalharia o scroll normal de listas/tabelas) e nunca com um
// modal aberto. Atualiza recarregando a página — como a aba ativa fica salva em
// sessionStorage (ver trocarAba em painel.html), o recarregamento continua na mesma aba,
// nunca volta pra Dashboard.
(function(){
  const DISTANCIA_GATILHO = 70; // px de indicador que precisa puxar pra soltar e atualizar
  const RESISTENCIA = 2.2; // puxar 2.2px de dedo = 1px de indicador ("efeito elástico")
  const DESLOCAMENTO_MAX = DISTANCIA_GATILHO * 1.4;

  let inicioY = null;
  let deslocamentoAtual = 0;
  let indicador = null;

  function modalAberto(){
    return !!document.querySelector(".ugc-modal-overlay:not(.oculto)");
  }

  function obterIndicador(){
    if (indicador) return indicador;

    const estilo = document.createElement("style");
    estilo.textContent = `
      #puxarAtualizarIndicador{
        position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: center;
        pointer-events: none; z-index: 99998; opacity: 0;
      }
      #puxarAtualizarIndicador .bolinha{
        margin-top: -50px; width: 34px; height: 34px; border-radius: 50%;
        background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.2);
        display: flex; align-items: center; justify-content: center;
      }
      #puxarAtualizarIndicador svg{ width: 18px; height: 18px; }
      #puxarAtualizarIndicador.atualizando svg{ animation: puxarAtualizarGirar .7s linear infinite; }
      @keyframes puxarAtualizarGirar{ to{ transform: rotate(360deg); } }
    `;
    document.head.appendChild(estilo);

    indicador = document.createElement("div");
    indicador.id = "puxarAtualizarIndicador";
    indicador.innerHTML = `<div class="bolinha"><svg viewBox="0 0 24 24" fill="none" stroke="var(--coral, #000080)" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg></div>`;
    document.body.appendChild(indicador);
    return indicador;
  }

  function aplicarDeslocamento(px){
    deslocamentoAtual = px;
    const el = obterIndicador();
    el.style.opacity = String(Math.min(px / DISTANCIA_GATILHO, 1));
    el.querySelector(".bolinha").style.transform = `translateY(${px}px) rotate(${px * 3}deg)`;
  }

  function resetar(){
    inicioY = null;
    deslocamentoAtual = 0;
    if (indicador){
      indicador.style.opacity = "0";
      indicador.querySelector(".bolinha").style.transform = "translateY(0)";
    }
  }

  document.addEventListener("touchstart", (e) => {
    if (modalAberto() || document.scrollingElement.scrollTop > 0){ inicioY = null; return; }
    inicioY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (inicioY === null) return;
    if (modalAberto() || document.scrollingElement.scrollTop > 0){ resetar(); return; }
    const distanciaDedo = e.touches[0].clientY - inicioY;
    aplicarDeslocamento(distanciaDedo > 0 ? Math.min(distanciaDedo / RESISTENCIA, DESLOCAMENTO_MAX) : 0);
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (inicioY === null) return;
    if (deslocamentoAtual >= DISTANCIA_GATILHO){
      const el = obterIndicador();
      el.classList.add("atualizando");
      el.style.opacity = "1";
      el.querySelector(".bolinha").style.transform = `translateY(${DISTANCIA_GATILHO}px)`;
      location.reload();
    } else {
      resetar();
    }
  }, { passive: true });
})();
