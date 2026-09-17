// supabase/functions/send-briefing-email/index.ts
//
// Manda um e-mail pra Edi assim que um briefing novo chega pelo formulário
// (edilainesantos.com/formularioadmin). Chamada só pelo gatilho do banco
// (trigger_notificar_novo_briefing, em cima de painel_briefing_respostas),
// autenticada pelo mesmo x-sched-key que o send-push já usa — nunca é
// chamada direto do navegador de quem preenche o formulário.
//
// Usa a Resend (https://resend.com) pra mandar o e-mail de verdade. Sem
// verificar um domínio próprio na Resend, só dá pra mandar pro e-mail com
// que você criou a conta lá — o que já resolve, já que o destino é sempre
// o seu próprio e-mail.

const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_DESTINO = Deno.env.get("BRIEFING_EMAIL_DESTINO") ?? "edilainesantosugc@gmail.com";

// Rótulos legíveis pras chaves salvas em "respostas" (jsonb). Se uma
// pergunta nova for adicionada no formulário sem entrar aqui, o e-mail
// ainda mostra a chave crua — só menos bonitinho, nada quebra.
const ROTULOS: Record<string, string> = {
  organizacao_hoje: "Como organiza hoje",
  organizacao_hoje_detalhe: "Detalhe (Outro)",
  tentou_antes: "Já tentou resolver antes / o que não funcionou",
  tipo_site: "Tipo de site público",
  login_equipe: "Quem tem login",
  tipo_leads: "Tipo de leads",
  resposta_leads: "Resposta a leads hoje",
  objetivo_email: "Objetivo do disparo de e-mail",
  ferramenta_email: "Ferramenta de e-mail",
  ferramenta_email_detalhe: "Qual ferramenta",
  escopo_financeiro: "Escopo do financeiro",
  emite_nf_financeiro: "Emite nota fiscal (financeiro)",
  estilo_organizacional: "Estilo organizacional",
  quem_usa: "Quem vai usar o painel",
  quem_usa_detalhe: "Quantas pessoas",
  rotina_uso: "Rotina de uso",
  dominio: "Domínio",
  cnpj_nf: "Tem CNPJ e emite NF",
  quer_app: "Quer o painel como app no celular",
  logo_status: "Logo/ícone do app",
  logo_status_arquivo_url: "Arquivo da logo enviado",
  quer_notificacoes: "Quer notificações no painel",
  quer_notificacoes_detalhe: "Do que seriam as notificações",
  visao_crescimento: "Visão de crescimento",
  suporte_pos_entrega: "Suporte pós-entrega",
  faixa_valor: "Já tem valor em mente",
  faixa_valor_detalhe: "Faixa de valor",
  urgencia: "Urgência",
  prazo_desejado: "Prazo desejado",
  referencia_visual: "Referência visual (painel/ferramenta que gostou)",
  definicao_sucesso: "O que é o painel \"funcionando bem\"",
};

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

  let corpoRequisicao: { nome?: string; contato?: string; respostas?: Record<string, string> } = {};
  try {
    corpoRequisicao = await req.json();
  } catch (_erro) {
    corpoRequisicao = {};
  }

  const { nome, contato, respostas } = corpoRequisicao;

  const linhasHtml = Object.entries(respostas ?? {})
    .map(([chave, valor]) => `
      <tr>
        <td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap;vertical-align:top;">${escapeHtml(ROTULOS[chave] ?? chave)}</td>
        <td style="padding:6px 0;">${String(valor).startsWith("http") ? `<a href="${escapeHtml(String(valor))}">Ver arquivo</a>` : escapeHtml(String(valor))}</td>
      </tr>
    `)
    .join("");

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head><body>
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px;">
      <h2 style="color:#000080;margin-bottom:4px;">Novo briefing preenchido 🦋</h2>
      <p style="margin-top:0;">
        <strong>Nome:</strong> ${escapeHtml(nome ?? "")}<br>
        <strong>Contato:</strong> ${escapeHtml(contato ?? "")}
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">${linhasHtml}</table>
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
        from: "Briefing do Painel <onboarding@resend.dev>",
        to: [EMAIL_DESTINO],
        subject: `Novo briefing: ${nome ?? "alguém"}`,
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
    console.error("Erro enviando e-mail do briefing:", erro);
    return respostaJson({ error: "Falha ao enviar e-mail" }, 500);
  }
});
