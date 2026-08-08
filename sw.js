/* sw.js — service worker compartilhado pelo painel.html e pelo Portal do
   Gustavo. Só existe pra receber notificações push (mesmo com o app fechado)
   e abrir a página certa quando a pessoa toca na notificação. Fica na raiz
   do site de propósito: um service worker aqui cobre tanto "/" quanto
   "/gustavo/" sem precisar de uma cópia em cada pasta. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (erro) { dados = {}; }

  const titulo = dados.titulo || "Painel";
  const opcoes = {
    body: dados.corpo || "",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    data: { url: dados.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  // Se já tem uma aba aberta na mesma página, navega ela pra essa mesma URL antes
  // de focar — só focar (sem navegar) deixava a aba com os dados antigos, de antes
  // da notificação chegar (mensagem nova do Portfólio não aparecia, pop-up de aviso
  // não aparecia), porque o painel só busca os dados uma vez, ao carregar a página.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url.includes(url) && "navigate" in cliente) {
          return cliente.navigate(url).then((c) => c.focus());
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
