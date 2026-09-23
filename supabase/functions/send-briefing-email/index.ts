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
//
// O e-mail reproduz o formulário inteiro como uma única página com rolagem:
// cada seção com seu título, cada pergunta com TODAS as opções (a marcada
// em destaque verde, as outras apagadas) — em vez da tabela crua de antes.
// A estrutura de SECOES abaixo é uma cópia da ETAPAS do formulário
// (formularioadmin/index.html); se uma pergunta mudar lá, muda aqui também.

const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_DESTINO = Deno.env.get("BRIEFING_EMAIL_DESTINO") ?? "edilainesantosugc@gmail.com";

type Campo = {
  nome: string;
  pergunta: string;
  tipo: "radio" | "sim_nao" | "texto_curto" | "texto_livre";
  opcoes?: string[];
  outro?: boolean;
  detalheSe?: string;
  detalhePergunta?: string;
  arquivo?: boolean;
};

const SECOES: { secao: string; campos: Campo[] }[] = [
  {
    secao: "Situação atual",
    campos: [
      { nome: "organizacao_hoje", pergunta: "Como você organiza isso hoje?", tipo: "radio",
        opcoes: ["Planilha", "Papel", "Espalhado em vários aplicativos", "Outro"], outro: true, detalhePergunta: "Conta pra mim como é" },
      { nome: "tentou_antes", pergunta: "Você já tentou resolver isso antes? O que não funcionou?", tipo: "texto_livre" },
    ],
  },
  {
    secao: "Site (parte pública)",
    campos: [
      { nome: "tipo_site", pergunta: "O site vai ter um mini-portfólio/perfil de cada criadora, ou é só institucional?", tipo: "radio",
        opcoes: ["Mini-portfólio por pessoa", "Só institucional (apresentação da agência/negócio)", "Não preciso de site público"] },
      { nome: "login_equipe", pergunta: "As pessoas envolvidas vão ter login pra acompanhar algo, ou o acesso logado é só pra você no admin?", tipo: "radio",
        opcoes: ["Só eu", "Também para a equipe"] },
    ],
  },
  {
    secao: "Leads",
    campos: [
      { nome: "tipo_leads", pergunta: "Os leads que chegam são:", tipo: "radio",
        opcoes: ["Marcas/clientes querendo contratar", "Pessoas querendo entrar pro time", "Os dois", "Não se aplica"] },
      { nome: "resposta_leads", pergunta: "Hoje, quando chega um lead, alguém responde na mão, ou você imagina algo mais automático?", tipo: "radio",
        opcoes: ["Resposta manual", "Automação (sequência de e-mails)", "Não sei ainda"] },
    ],
  },
  {
    secao: "Disparo de e-mail",
    campos: [
      { nome: "objetivo_email", pergunta: "O disparo de e-mail é mais pra:", tipo: "radio",
        opcoes: ["Nutrir lead (sequência automática)", "Comunicação pontual com sua rede/equipe", "Os dois"] },
      { nome: "ferramenta_email", pergunta: "Você já usa alguma ferramenta de e-mail hoje, ou quer isso nativo dentro do painel?", tipo: "radio",
        opcoes: ["Já uso uma ferramenta", "Quero nativo no painel", "Não uso nada ainda"], detalheSe: "Já uso uma ferramenta", detalhePergunta: "Qual ferramenta?" },
    ],
  },
  {
    secao: "Financeiro",
    campos: [
      { nome: "escopo_financeiro", pergunta: "Financeiro pra você é:", tipo: "radio",
        opcoes: ["Controlar repasse/comissão pra terceiros", "Faturamento do seu negócio", "Tudo junto"] },
      { nome: "emite_nf_financeiro", pergunta: "Você emite nota fiscal? Isso deve entrar no financeiro do painel?", tipo: "sim_nao" },
    ],
  },
  {
    secao: "Organizacional",
    campos: [
      { nome: "estilo_organizacional", pergunta: "É mais gestão de projeto/campanha por pessoa, ou rotina interna da equipe?", tipo: "radio",
        opcoes: ["Gestão de campanha (prazo, briefing, aprovação)", "Rotina interna (tarefas, checklist)", "Os dois"] },
    ],
  },
  {
    secao: "Uso e equipe",
    campos: [
      { nome: "quem_usa", pergunta: "O painel será usado só por você, ou mais pessoas também vão utilizá-lo?", tipo: "radio",
        opcoes: ["Só eu", "Eu + equipe"], detalheSe: "Eu + equipe", detalhePergunta: "Quantas pessoas?" },
      { nome: "rotina_uso", pergunta: "Como seria a rotina de uso?", tipo: "radio",
        opcoes: ["Diário", "Semanal", "Uso pontual"] },
    ],
  },
  {
    secao: "Infraestrutura",
    campos: [
      { nome: "dominio", pergunta: "Você prefere ter um domínio próprio, ou começar com um modelo gratuito pra testar antes de investir?", tipo: "radio",
        opcoes: ["Domínio próprio", "Modelo gratuito", "Não sei, quero orientação"] },
      { nome: "cnpj_nf", pergunta: "Você tem CNPJ e emite nota fiscal?", tipo: "sim_nao" },
    ],
  },
  {
    secao: "App e identidade visual",
    campos: [
      { nome: "quer_app", pergunta: "Você quer que o painel funcione como um aplicativo no celular (ícone na tela inicial, abre em tela cheia, tipo um app de verdade)?", tipo: "sim_nao" },
      { nome: "logo_status", pergunta: "Se sim, você já tem uma logo/ícone pronto pra esse aplicativo, ou vai precisar que eu ajude a criar?", tipo: "radio",
        opcoes: ["Já tenho pronto", "Preciso de ajuda pra criar", "Ainda não pensei nisso"],
        detalheSe: "Já tenho pronto", detalhePergunta: "Arquivo enviado", arquivo: true },
      { nome: "quer_notificacoes", pergunta: "Você quer notificações/alertas no painel?", tipo: "sim_nao",
        detalheSe: "Sim", detalhePergunta: "Do que seriam?" },
    ],
  },
  {
    secao: "Visão de futuro",
    campos: [
      { nome: "visao_crescimento", pergunta: "A longo prazo, você imagina o painel crescendo, ou prefere algo mais enxuto mesmo?", tipo: "radio",
        opcoes: ["Crescer com o tempo (mais abas, mais automações)", "Enxuto e direto ao ponto"] },
      { nome: "suporte_pos_entrega", pergunta: "Depois de entregue, você mesma fará pequenos ajustes, ou vai preferir que eu continue dando suporte?", tipo: "radio",
        opcoes: ["Eu mesma ajusto", "Prefiro suporte contínuo", "Não sei ainda"] },
    ],
  },
  {
    secao: "Orçamento e prazo",
    campos: [
      { nome: "faixa_valor", pergunta: "Você já tem uma ideia de quanto pretende investir, ou prefere que eu apresente as opções primeiro?", tipo: "radio",
        opcoes: ["Já tenho um valor em mente", "Prefiro ver as opções"], detalheSe: "Já tenho um valor em mente", detalhePergunta: "Qual faixa de valor?" },
      { nome: "urgencia", pergunta: "Isso é uma prioridade pra resolver logo, ou você está mais numa fase de planejamento?", tipo: "radio",
        opcoes: ["Preciso resolver logo", "Estou planejando, sem pressa"] },
      { nome: "prazo_desejado", pergunta: "Quando você gostaria de ter isso em mãos?", tipo: "texto_curto" },
    ],
  },
  {
    secao: "Resultado esperado",
    campos: [
      { nome: "referencia_visual", pergunta: "Existe algum painel ou ferramenta que você já viu e gostou que eu possa usar como referência?", tipo: "texto_livre" },
      { nome: "definicao_sucesso", pergunta: "O que seria, pra você, o painel \"funcionando bem\"? O que te faria sentir que valeu o investimento?", tipo: "texto_livre" },
    ],
  },
];

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPerguntaRadioOuSimNao(campo: Campo, respostas: Record<string, string>): string {
  const valorMarcado = respostas[campo.nome] ?? "";
  const opcoes = campo.tipo === "sim_nao" ? ["Sim", "Não"] : (campo.opcoes ?? []);

  const listaHtml = opcoes.map(op => {
    const marcada = op === valorMarcado;
    return `
      <div style="display:flex;align-items:center;gap:10px;${marcada ? "" : "opacity:.55;"}">
        <span style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${marcada ? "#000080" : "rgba(0,0,128,.35)"};background:${marcada ? "#000080" : "#ffffff"};flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:11px;line-height:1;color:#ffffff;">${marcada ? "&#10003;" : ""}</span>
        <span style="font-size:14px;${marcada ? "font-weight:700;color:#1a1a1a;" : "font-weight:400;color:rgba(26,26,26,.5);"}">${marcada ? `<span style="background:rgba(45,122,79,.28);border-radius:3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:1px 3px;">${escapeHtml(op)}</span>` : escapeHtml(op)}</span>
      </div>
    `;
  }).join("");

  return `<div style="display:flex;flex-direction:column;gap:7px;">${listaHtml}</div>`;
}

function renderDetalhe(campo: Campo, respostas: Record<string, string>): string {
  const valorMarcado = respostas[campo.nome] ?? "";
  if (!campo.detalheSe && !campo.outro) return "";
  const gatilho = campo.outro ? "Outro" : campo.detalheSe;
  if (valorMarcado !== gatilho) return "";

  const rotulo = campo.detalhePergunta || "Detalhe";

  if (campo.arquivo) {
    const url = respostas[`${campo.nome}_arquivo_url`];
    if (!url) return "";
    return `<div style="margin-top:10px;margin-left:4px;padding-left:14px;border-left:2px solid rgba(0,0,128,.18);font-size:13px;color:rgba(0,0,128,.7);"><strong style="color:#000080;">${escapeHtml(rotulo)}:</strong> <a href="${escapeHtml(url)}" style="color:#000080;">Ver arquivo</a></div>`;
  }

  const detalheTexto = respostas[`${campo.nome}_detalhe`];
  if (!detalheTexto) return "";
  return `<div style="margin-top:10px;margin-left:4px;padding-left:14px;border-left:2px solid rgba(0,0,128,.18);font-size:13px;color:rgba(0,0,128,.7);"><strong style="color:#000080;">${escapeHtml(rotulo)}:</strong> ${escapeHtml(detalheTexto)}</div>`;
}

function renderCampo(campo: Campo, respostas: Record<string, string>): string {
  const valor = respostas[campo.nome];
  if (!valor) return ""; // pergunta condicional que não apareceu pra essa pessoa

  const perguntaHtml = `<span style="display:block;font-weight:700;font-size:14px;line-height:1.4;margin-bottom:12px;color:#1a1a1a;">${escapeHtml(campo.pergunta)}</span>`;

  let respostaHtml = "";
  if (campo.tipo === "radio" || campo.tipo === "sim_nao") {
    respostaHtml = renderPerguntaRadioOuSimNao(campo, respostas);
  } else {
    respostaHtml = `<div style="background:#fbfbfe;border:1.5px solid rgba(0,0,128,.09);border-radius:12px;padding:12px 14px;font-size:14px;color:#1a1a1a;line-height:1.55;white-space:pre-wrap;">${escapeHtml(valor)}</div>`;
  }

  const detalheHtml = renderDetalhe(campo, respostas);

  return `<div style="margin-bottom:22px;">${perguntaHtml}${respostaHtml}${detalheHtml}</div>`;
}

function renderPagina(nome: string, contato: string, respostas: Record<string, string>): string {
  const secoesHtml = SECOES.map(secao => {
    const camposHtml = secao.campos.map(c => renderCampo(c, respostas)).join("");
    if (!camposHtml.trim()) return ""; // seção inteira sem resposta (não deveria acontecer, é rede de segurança)
    return `
      <div style="background:#ffffff;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,128,.10);padding:26px 24px;margin-bottom:18px;">
        <h2 style="font-family:Georgia,'Playfair Display',serif;font-size:18px;font-weight:600;margin:0 0 20px;padding-bottom:12px;border-bottom:1.5px solid rgba(0,0,128,.09);color:#000080;">${escapeHtml(secao.secao)}</h2>
        ${camposHtml}
      </div>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="margin:0;background:#eef0f8;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:36px 18px 60px;">
        <div style="text-align:center;margin-bottom:26px;">
          <div style="font-size:32px;margin-bottom:8px;">&#129419;</div>
          <h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:600;font-size:24px;margin:0 0 14px;color:#000080;">Novo briefing preenchido</h1>
          <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:14px 22px;box-shadow:0 8px 22px rgba(0,0,128,.10);">
            <strong style="display:block;font-size:16px;color:#000080;">${escapeHtml(nome || "")}</strong>
            <span style="color:rgba(0,0,128,.65);font-size:14px;">${escapeHtml(contato || "")}</span>
          </div>
        </div>
        ${secoesHtml}
        <div style="text-align:center;margin-top:30px;">
          <a href="https://edilainesantos.com/painel.html" style="display:inline-block;background:#000080;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 26px;border-radius:14px;">Abrir o painel</a>
        </div>
      </div>
    </body></html>
  `;
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
  const html = renderPagina(nome ?? "", contato ?? "", respostas ?? {});

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
