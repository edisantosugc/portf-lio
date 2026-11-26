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
  tipo: "radio" | "sim_nao" | "texto_curto" | "texto_livre" | "checkbox";
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

// Formulário de interesse do app de gestão (versão 2, desde 2026-11-24).
// Respostas com respostas.versao_formulario = 2 usam esta lista; as antigas
// continuam usando SECOES acima. Espelha a ETAPAS do formulário.
const SECOES_V2: { secao: string; campos: Campo[] }[] = [
  {
    secao: "Seus dados",
    campos: [
      { nome: "area_trabalho", pergunta: "Com o que você trabalha?", tipo: "radio",
        opcoes: ["Criação de conteúdo", "Prestação de serviços", "Loja ou comércio", "Consultório ou escritório", "Produção sob medida, como marcenaria", "Outro"], outro: true, detalhePergunta: "Qual" },
    ],
  },
  {
    secao: "Como quer o app",
    campos: [
      { nome: "formato_desejado", pergunta: "Como você prefere ter o seu app?", tipo: "radio",
        opcoes: ["Quero o app pronto, feito por você", "Quero aprender a montar o meu", "Quero pronto e também aprender a mexer nele depois", "Ainda não sei, quero conversar primeiro em uma reunião"] },
    ],
  },
  {
    secao: "Como está hoje",
    campos: [
      { nome: "organizacao_atual", pergunta: "Como você se organiza hoje?", tipo: "checkbox",
        opcoes: ["Planilha", "Papel ou caderno", "Vários aplicativos", "WhatsApp", "Não me organizo", "Outro"], outro: true, detalhePergunta: "Outro" },
      { nome: "maior_dor", pergunta: "O que mais te dá dor de cabeça hoje?", tipo: "texto_livre" },
    ],
  },
  {
    secao: "O que quer no app",
    campos: [
      { nome: "itens_essenciais", pergunta: "O que não pode faltar?", tipo: "checkbox",
        opcoes: ["Agenda", "Clientes", "Orçamentos", "Pedidos ou projetos com prazo", "Tarefas e lembretes", "Financeiro", "Notas fiscais", "Contratos e documentos", "Página ou portfólio", "Formulário pra receber clientes", "E-mails automáticos", "Outro"], outro: true, detalhePergunta: "Outro" },
      { nome: "quem_vai_usar", pergunta: "Quem vai usar?", tipo: "radio", opcoes: ["Só eu", "Eu + equipe"], detalheSe: "Eu + equipe", detalhePergunta: "Pessoas no total" },
      { nome: "app_no_celular", pergunta: "Quer que funcione como aplicativo no celular?", tipo: "radio", opcoes: ["Sim", "Não", "Tanto faz"] },
      { nome: "tem_logo", pergunta: "Você já tem logo?", tipo: "radio", opcoes: ["Já tenho", "Preciso de ajuda pra criar", "Ainda não pensei"] },
    ],
  },
  {
    secao: "Orçamento e prazo",
    campos: [
      { nome: "investimento", pergunta: "Quanto pretende investir?", tipo: "radio",
        opcoes: ["Prefiro ver as opções primeiro", "Até R$ ___"], detalheSe: "Até R$ ___", detalhePergunta: "Valor" },
      { nome: "prazo_necessidade", pergunta: "Pra quando você precisa?", tipo: "radio",
        opcoes: ["O quanto antes", "Nos próximos 30 dias", "Em 2 a 3 meses", "Estou só planejando"] },
    ],
  },
  {
    secao: "Fechamento",
    campos: [
      { nome: "observacoes_finais", pergunta: "Tem mais alguma coisa que eu precise saber?", tipo: "texto_livre" },
    ],
  },
];

// deno-lint-ignore no-explicit-any
type Respostas = Record<string, any>;

function marcou(valor: unknown, opcao: string | undefined): boolean {
  return Array.isArray(valor) ? valor.includes(opcao) : valor === opcao;
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Visual igual ao painel (Mensagens recebidas): um cartão branco só, seções
// com título pequeno em maiúsculo separadas por linha, uma opção por linha
// com quadradinho. Tudo em <table> + estilo inline porque o Gmail ignora
// display:flex/opacity — era isso que deixava as opções espremidas lado a lado.
const COR_AZUL = "#000080";
const COR_TEXTO = "#1a1a1a";
const COR_APAGADO = "#8a8a99";
const COR_LINHA = "#e6e6ef";

function quadradinho(marcada: boolean): string {
  return marcada
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="16" height="16" align="center" valign="middle" style="width:16px;height:16px;background:${COR_AZUL};border:1.5px solid ${COR_AZUL};border-radius:4px;color:#ffffff;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;">&#10003;</td></tr></table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="16" height="16" style="width:16px;height:16px;background:#ffffff;border:1.5px solid #c9c9d6;border-radius:4px;font-size:1px;line-height:16px;">&nbsp;</td></tr></table>`;
}

function renderPerguntaRadioOuSimNao(campo: Campo, respostas: Respostas): string {
  const valorMarcado = respostas[campo.nome] ?? "";
  const opcoes = campo.tipo === "sim_nao" ? ["Sim", "Não"] : (campo.opcoes ?? []);

  const linhas = opcoes.map(op => {
    const marcada = marcou(valorMarcado, op);
    const texto = marcada
      ? `<span style="background:#cfe6d9;border-radius:3px;padding:1px 4px;font-weight:700;color:${COR_TEXTO};">${escapeHtml(op)}</span>`
      : `<span style="color:${COR_APAGADO};">${escapeHtml(op)}</span>`;
    return `<tr>
        <td width="26" valign="top" style="width:26px;padding:4px 0;">${quadradinho(marcada)}</td>
        <td valign="top" style="padding:4px 0;font-size:13px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">${texto}</td>
      </tr>`;
  }).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${linhas}</table>`;
}

function renderDetalhe(campo: Campo, respostas: Respostas): string {
  const valorMarcado = respostas[campo.nome] ?? "";
  if (!campo.detalheSe && !campo.outro) return "";
  const gatilho = campo.outro ? "Outro" : campo.detalheSe;
  if (!marcou(valorMarcado, gatilho)) return "";

  const rotulo = campo.detalhePergunta || "Detalhe";
  const estilo = `margin-top:8px;padding-left:12px;border-left:2px solid #c9c9e6;font-size:13px;line-height:18px;color:${COR_TEXTO};font-family:Arial,Helvetica,sans-serif;`;

  if (campo.arquivo) {
    const url = respostas[`${campo.nome}_arquivo_url`];
    if (!url) return "";
    return `<div style="${estilo}"><strong style="color:${COR_AZUL};">${escapeHtml(rotulo)}:</strong> <a href="${escapeHtml(url)}" style="color:${COR_AZUL};">Ver arquivo</a></div>`;
  }

  const detalheTexto = respostas[`${campo.nome}_detalhe`];
  if (!detalheTexto) return "";
  return `<div style="${estilo}"><strong style="color:${COR_AZUL};">${escapeHtml(rotulo)}:</strong> ${escapeHtml(String(detalheTexto))}</div>`;
}

function renderCampo(campo: Campo, respostas: Respostas): string {
  const valor = respostas[campo.nome];
  if (!valor) return ""; // pergunta condicional que não apareceu pra essa pessoa

  const perguntaHtml = `<div style="font-weight:700;font-size:13px;line-height:18px;margin:0 0 8px;color:${COR_TEXTO};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(campo.pergunta)}</div>`;

  let respostaHtml = "";
  if (campo.tipo === "radio" || campo.tipo === "sim_nao" || campo.tipo === "checkbox") {
    respostaHtml = renderPerguntaRadioOuSimNao(campo, respostas);
  } else {
    respostaHtml = `<div style="background:#f7f7fb;border:1px solid ${COR_LINHA};border-radius:8px;padding:10px 12px;font-size:13px;color:${COR_TEXTO};line-height:19px;white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(String(valor))}</div>`;
  }

  return `<div style="margin-bottom:18px;">${perguntaHtml}${respostaHtml}${renderDetalhe(campo, respostas)}</div>`;
}

function renderPagina(nome: string, contato: string, respostas: Respostas): string {
  const secoes = Number(respostas.versao_formulario) === 2 ? SECOES_V2 : SECOES;
  const secoesHtml = secoes.map(secao => {
    const camposHtml = secao.campos.map(c => renderCampo(c, respostas)).join("");
    if (!camposHtml.trim()) return ""; // seção inteira sem resposta (rede de segurança)
    return `<tr><td style="border-top:1px solid ${COR_LINHA};padding:18px 22px 4px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b6b7b;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(secao.secao)}</div>
        ${camposHtml}
      </td></tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f8;">
    <tr><td align="center" style="padding:28px 12px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${COR_LINHA};border-radius:14px;">
        <tr><td style="padding:20px 22px 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:12px;"><span style="display:inline-block;background:#f0f0f4;color:#6b6b7b;font-size:10px;font-weight:700;letter-spacing:.06em;border-radius:20px;padding:4px 10px;font-family:Arial,Helvetica,sans-serif;">BRIEFING</span></td>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:14px;font-weight:700;text-transform:uppercase;color:${COR_TEXTO};">${escapeHtml(nome || "")}</div>
              <div style="font-size:12px;color:#6b6b7b;margin-top:2px;">${escapeHtml(contato || "")}</div>
            </td>
          </tr></table>
        </td></tr>
        ${secoesHtml}
        <tr><td align="center" style="border-top:1px solid ${COR_LINHA};padding:20px 22px 24px;">
          <a href="https://edilainesantos.com/painel.html" style="display:inline-block;background:${COR_AZUL};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">Abrir no painel</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
