/* =========================================================================
   js/push.js
   Ativa notificações push no navegador: registra o service worker, pede
   permissão, inscreve no PushManager do navegador e salva essa inscrição no
   Supabase (tabela push_subscricoes). Usado tanto pelo painel.html (conta
   "di") quanto pelo gustavo/index.html (conta "gustavo") — cada página passa
   qual conta é a sua na hora de chamar.

   A chave pública abaixo (VAPID) não é segredo — ela só identifica o site
   pros serviços de push do navegador (Google/Apple/etc). A chave PRIVADA
   correspondente mora só na Edge Function, nunca aqui.
   ========================================================================= */

const VAPID_PUBLIC_KEY = "BNKJ8ewrRnQ6wjq808cQ8m7G1zVKijFfPxVydfBZxz9l-VjkNt6uh33cKqb77Xd3LE3p5tfBVJkRCZlk_WYDU9Q";

function base64UrlParaUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

// Estado atual: "indisponivel" (navegador não suporta), "negada" (bloqueou
// antes), "inativa" (nunca ativou/desativou) ou "ativa"
async function statusNotificacoesPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "indisponivel";
  if (Notification.permission === "denied") return "negada";
  const registro = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registro) return "inativa";
  const inscricao = await registro.pushManager.getSubscription();
  return inscricao ? "ativa" : "inativa";
}

async function ativarNotificacoesPush(supabaseClient, conta) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Esse navegador não suporta notificações push. No iPhone, precisa ter instalado o app na tela de início primeiro.");
    return false;
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    alert("Permissão de notificação não foi concedida.");
    return false;
  }

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const json = inscricao.toJSON();
  const { error } = await supabaseClient.from("push_subscricoes").upsert(
    {
      conta,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Erro ao salvar inscrição de push:", error);
    alert("Não foi possível ativar as notificações agora.");
    return false;
  }

  return true;
}

async function desativarNotificacoesPush(supabaseClient) {
  const registro = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registro) return true;

  const inscricao = await registro.pushManager.getSubscription();
  if (inscricao) {
    await supabaseClient.from("push_subscricoes").delete().eq("endpoint", inscricao.endpoint);
    await inscricao.unsubscribe();
  }
  return true;
}
