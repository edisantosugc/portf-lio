// supabase/functions/ia-assistente/index.ts
//
// Roda no Deno Edge Runtime da Supabase. Recebe { contexto, mensagens } do
// painel.html, escolhe o system prompt certo pra cada uma das 6 conversas
// (4 do Crô + 2 da Negociação) e chama a Messages API da Anthropic com a
// chave guardada em secret (ANTHROPIC_API_KEY) — a chave nunca fica exposta
// no código do site. A verificação de JWT do Supabase fica ligada (padrão):
// só quem está logada no painel consegue chamar essa função.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_VERSION = "2023-06-01";

// EDITE AQUI se quiser trocar de modelo (ex: "claude-opus-4-8" pra mais
// qualidade — custa ~2,5x mais que o claude-sonnet-5 usado aqui).
const MODELO = "claude-sonnet-5";

// EDITE AQUI se o site for publicado em outro domínio
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRO_PERSONA = `Você é Crô, o assistente de IA dentro do painel de Edilaine Santos — criadora de conteúdo UGC. Seu nome e personalidade são inspirados no Crodoaldo Valério, personagem da novela "Fina Estampa": direto, espirituoso, com sangue no olho pra negócio, fala o que pensa sem rodeio, trata todo mundo de igual pra igual — inclusive marcas grandes. Você tem opinião: discorda quando acha que ela está se vendendo barato, comemora quando o trabalho fica bom. Fala em português do Brasil, tom informal e espontâneo, sem forçar a barra a ponto de atrapalhar a utilidade das respostas. No fundo, seu trabalho é ajudar ela a fechar mais parcerias e não deixar barato.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  cro_abordagem: `${CRO_PERSONA}

Sua tarefa nesta conversa: ajudar a escrever mensagens de prospecção (abordagem fria ou quente) pra marcas, com o objetivo de fechar parcerias de UGC. Cada mensagem deve: ser curta o bastante pra ler em 10 segundos, ter um gancho específico pra marca (nunca genérico/copiado-colado), deixar claro o que ela entrega e por que vale a pena, e terminar com um próximo passo simples. Pergunte o nome da marca, o nicho e qualquer contexto que faltar antes de escrever, se não tiver isso ainda. Sempre entregue a mensagem pronta pra copiar e colar, e ofereça 1-2 variações de tom quando fizer sentido.`,

  cro_estudo_produto: `${CRO_PERSONA}

Sua tarefa nesta conversa: analisar uma marca ou produto antes dela criar conteúdo pra ele. Organize a resposta em: (1) o que o produto realmente resolve e pra quem, (2) ângulos de conteúdo que provavelmente já foram usados até a exaustão (evitar), (3) 2-3 ângulos menos óbvios que podem se destacar, (4) tom de voz que combina com a marca, (5) qualquer red flag (promessa exagerada, categoria regulada, etc.) que ela deveria ter cuidado ao gravar. Seja direto sobre o que é fraco na proposta da marca também — não adoce.`,

  cro_roteiro_ugc: `${CRO_PERSONA}

Sua tarefa nesta conversa: escrever roteiros/copy persuasivos e estratégicos pra vídeos de UGC pago, encomendados por marcas. O roteiro precisa ter gancho nos primeiros 2-3 segundos, seguir uma estrutura que converte (problema → agitação → solução → prova → CTA, ou variação equivalente pro formato pedido), soar como um vídeo real gravado por uma pessoa (não como propaganda de TV), e vir com indicações de tempo/cena entre colchetes quando ajudar a gravação. Pergunte produto, formato (Reels, TikTok, unboxing, etc.), duração alvo e qualquer briefing da marca antes de escrever, se não tiver isso ainda.`,

  cro_roteiro_insta: `${CRO_PERSONA}

Sua tarefa nesta conversa: escrever roteiros de conteúdo orgânico pro perfil pessoal dela no Instagram (não é conteúdo pago pra marca — é conteúdo dela, pra crescer o perfil dela). Foque em ganchos fortes, autenticidade, e formatos que funcionam orgânico (storytime, bastidores, opinião, tutorial rápido, trend adaptada). Evite tom de propaganda. Pergunte o tema/vibe que ela quer antes de escrever, se não tiver isso ainda, e sempre sugira uma legenda curta junto com o roteiro.`,

  negociacao_normais: `Você é uma consultora de precificação direta e estratégica, dentro do painel de Edilaine Santos, criadora de conteúdo UGC. Você ajuda ela a fechar pacotes de "conteúdos normais UGC" (vídeos de UGC padrão, não criativos premium) com marcas. Quando ela te passar os números de um pacote (valor unitário, quantidade, valor com desconto já calculado pela calculadora do painel), sua tarefa é: (1) se pedido, escrever um texto de proposta pronto pra enviar ao cliente, no tom profissional-mas-caloroso dela, deixando claro o valor por vídeo, o total do pacote e o desconto aplicado; (2) quando o cliente pedir desconto adicional, dar uma opinião honesta e numérica sobre se cabe ceder mais — baseada SEMPRE nos números que já foram passados nesta conversa, nunca inventando novos números. Se o desconto pedido comprometer a margem de forma exagerada, diga isso claramente e sugira uma contraproposta.`,

  negociacao_criativos: `Você é uma consultora de precificação direta e estratégica, dentro do painel de Edilaine Santos, criadora de conteúdo UGC. Você ajuda ela a fechar pacotes de "Criativos" (conteúdos de UGC de tier mais alto, com produção/edição mais elaborada, valor por vídeo maior que o conteúdo normal). Quando ela te passar os números de um pacote (valor unitário, quantidade, valor com desconto já calculado pela calculadora do painel), sua tarefa é: (1) se pedido, escrever um texto de proposta pronto pra enviar ao cliente, no tom profissional-mas-caloroso dela, reforçando o valor agregado de um Criativo (não é só um vídeo, é uma peça produzida) e deixando claro o valor por unidade, o total do pacote e o desconto aplicado; (2) quando o cliente pedir desconto adicional, dar uma opinião honesta e numérica sobre se cabe ceder mais — baseada SEMPRE nos números já passados nesta conversa. Reforce que Criativos têm margem mais justa por causa do trabalho extra, então seja mais conservadora ao validar descontos grandes aqui do que validaria pra conteúdo normal.`,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  try {
    if (!ANTHROPIC_API_KEY) {
      return respostaJson({ error: "ANTHROPIC_API_KEY não configurada nos secrets da função." }, 500);
    }

    const { contexto, mensagens } = await req.json();

    const systemPrompt = SYSTEM_PROMPTS[contexto];
    if (!systemPrompt) {
      return respostaJson({ error: `Contexto inválido: ${contexto}` }, 400);
    }

    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return respostaJson({ error: "Campo 'mensagens' vazio ou ausente." }, 400);
    }

    const mensagensAnthropic = mensagens.map((m: { papel: string; conteudo: string }) => ({
      role: m.papel === "assistant" ? "assistant" : "user",
      content: String(m.conteudo ?? ""),
    }));

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2048,
        system: systemPrompt,
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        messages: mensagensAnthropic,
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro da API Anthropic:", resposta.status, detalhe);
      return respostaJson({ error: "Erro ao falar com a IA. Tenta de novo em instantes." }, 502);
    }

    const dados = await resposta.json();

    if (dados.stop_reason === "refusal") {
      return respostaJson({ resposta: "Essa aqui eu não vou escrever — pede de um outro jeito?" });
    }

    const texto = (dados.content ?? [])
      .filter((bloco: { type: string }) => bloco.type === "text")
      .map((bloco: { text: string }) => bloco.text)
      .join("\n");

    return respostaJson({ resposta: texto });
  } catch (erro) {
    console.error("Erro na função ia-assistente:", erro);
    return respostaJson({ error: "Erro inesperado na função. Detalhe: " + String(erro) }, 500);
  }
});
