// supabase/functions/send-roteiro-email/index.ts
//
// Manda um e-mail pra Edi quando uma marca aprova ou pede ajuste num roteiro,
// pelo link público (roteiro.html). Chamada só pelo gatilho do banco
// (trigger_notificar_resposta_roteiro, em cima de painel_roteiros_respostas),
// autenticada pelo mesmo x-sched-key que o send-push e o send-briefing-email já usam
// — nunca é chamada direto do navegador da marca.

const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_DESTINO = Deno.env.get("BRIEFING_EMAIL_DESTINO") ?? "edilainesantosugc@gmail.com";

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

  const chaveRecebida = req.headers.get("x-sched-key") ?? "";
  if (!SCHED_SECRET || chaveRecebida !== SCHED_SECRET) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  let corpoRequisicao: { marca?: string; tipo?: string } = {};
  try {
    corpoRequisicao = await req.json();
  } catch (_erro) {
    corpoRequisicao = {};
  }

  const { marca, tipo } = corpoRequisicao;
  const aprovado = tipo === "aprovado";
  const marcaSegura = escapeHtml(marca ?? "Uma marca");
  const assunto = aprovado ? `✅ ${marca ?? "Marca"} aprovou o roteiro` : `✏️ ${marca ?? "Marca"} pediu ajuste no roteiro`;
  const mensagem = aprovado
    ? "A marca visualizou o roteiro e aprovou — pode seguir pra gravação."
    : "A marca visualizou o roteiro e pediu ajustes nas condições. Confira o roteiro no painel.";

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head><body>
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px;">
      <h2 style="color:#000080;margin-bottom:4px;">${aprovado ? "Roteiro aprovado 💙" : "Ajuste solicitado no roteiro"}</h2>
      <p><strong>Marca:</strong> ${marcaSegura}</p>
      <p>${mensagem}</p>
      <p style="margin-top:24px;"><a href="https://edilainesantos.com/painel.html">Abrir o painel</a></p>
    </div>
    </body></html>
  `;

  try {
    const respostaResend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Roteiros <onboarding@resend.dev>",
        to: [EMAIL_DESTINO],
        subject: assunto,
        html,
      }),
    });

    if (!respostaResend.ok) {
      const detalhe = await respostaResend.text();
      console.error("Erro do Resend:", respostaResend.status, detalhe);
      return respostaJson({ error: "Falha ao enviar e-mail" }, 502);
    }

    return respostaJson({ ok: true });
  } catch (erro) {
    console.error("Erro enviando e-mail de resposta de roteiro:", erro);
    return respostaJson({ error: "Falha ao enviar e-mail" }, 500);
  }
});
