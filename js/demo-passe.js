/* =========================================================================
   js/demo-passe.js — LOGIN DA DEMONSTRAÇÃO (edilainesantos.com/demo)

   A demo só abre com o login próprio dela (não é conta do painel e não dá
   acesso a nenhum dado real). Quem confere e-mail/senha é o servidor
   (entrar_demo, ver seguranca_demo_portais.sql), que devolve um "passe"
   válido por 12 horas. Login errado: o servidor registra em
   Administrativo > Segurança e avisa a dona no celular.
   O passe fica guardado neste navegador (chave abaixo); cada página da demo
   confere com o servidor antes de mostrar qualquer coisa (ver js/demo.js).
   ========================================================================= */
window.DemoPasse = (function(){
  "use strict";
  const URL_BASE = "https://dqtoxxngjqyoibdgmrjr.supabase.co/rest/v1/rpc/";
  const CHAVE_PUBLICA = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc";
  const CHAVE_PASSE = "edi-demo-passe";
  const fetchOriginal = window.fetch.bind(window);

  async function chamar(funcao, corpo){
    const r = await fetchOriginal(URL_BASE + funcao, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CHAVE_PUBLICA, Authorization: "Bearer " + CHAVE_PUBLICA },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) throw new Error("servidor " + r.status);
    return r.json();
  }

  function lerPasse(){ try { return window.localStorage.getItem(CHAVE_PASSE); } catch (e) { return null; } }
  function gravarPasse(p){ try { p ? window.localStorage.setItem(CHAVE_PASSE, p) : window.localStorage.removeItem(CHAVE_PASSE); } catch (e) {} }

  function aparelho(){
    const ua = navigator.userAgent || "";
    const sistema = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro";
    const navegador = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /OPR\/|Opera/.test(ua) ? "Opera"
      : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Outro";
    return `${sistema} · ${navegador}`;
  }

  // true = passe válido; false = sem passe ou vencido
  async function validar(passe){
    const p = passe || lerPasse();
    if (!p) return false;
    try { return (await chamar("validar_demo", { p_token: p })) === true; }
    catch (e) { return false; }
  }

  // Devolve true se entrou; false se e-mail/senha errados. Lança erro se o servidor não respondeu.
  async function entrar(email, senha){
    const passe = await chamar("entrar_demo", { p_email: email, p_senha: senha, p_aparelho: aparelho() });
    if (passe === "bloqueado") throw new Error("bloqueado");
    if (typeof passe === "string" && passe){ gravarPasse(passe); return true; }
    return false;
  }

  function sair(){ gravarPasse(null); }

  return { validar, entrar, sair, lerPasse, CHAVE_PASSE };
})();
