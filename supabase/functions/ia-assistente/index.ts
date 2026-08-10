// supabase/functions/ia-assistente/index.ts
//
// Roda no Deno Edge Runtime da Supabase. Recebe { contexto, mensagens } do
// painel.html, escolhe o system prompt certo pra cada uma das 6 sub-abas da
// Iara (abordagem, estudo de produto, roteiro UGC, roteiro Instagram,
// negociação normais, negociação criativos) e chama a Chat Completions API
// da OpenAI com a chave guardada em secret (OPENAI_API_KEY) — a chave nunca
// fica exposta no código do site. A verificação de JWT do Supabase fica
// ligada (padrão): só quem está logada no painel consegue chamar essa
// função.
//
// EDITE AQUI (IARA_PERSONA) quando quiser ajustar como ela fala — tom de
// voz, marca pessoal, etc. Não precisa mexer em mais nada, só nesse texto.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// EDITE AQUI se quiser trocar de modelo (ex: "gpt-4o" pra mais qualidade —
// custa mais que o gpt-4o-mini usado aqui).
const MODELO = "gpt-4o-mini";

// Só pra validar que quem chamou está mesmo logada (ver checagem abaixo) —
// não lê nem escreve nada no banco, por isso a anon key (só ela) já basta.
import { createClient } from "npm:@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

// EDITE AQUI se o site for publicado em outro domínio
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IARA_PERSONA = `Você é Iara, o assistente de IA dentro do painel de Edilaine Santos — criadora de conteúdo UGC. É direta, tem opinião própria sobre o trabalho dela, e não deixa barato: discorda quando acha que ela está se vendendo por menos do que vale, comemora quando o trabalho fica bom. Fala em português do Brasil, tom informal e espontâneo, sem forçar a barra a ponto de atrapalhar a utilidade das respostas. No fundo, seu trabalho é ajudar ela a fechar mais parcerias.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  iara_abordagem: `${IARA_PERSONA}

Sua tarefa nesta conversa: ajudar a escrever mensagens de prospecção (abordagem fria ou quente) pra marcas, com o objetivo de fechar parcerias de UGC. Cada mensagem deve: ser curta o bastante pra ler em 10 segundos, ter um gancho específico pra marca (nunca genérico/copiado-colado), deixar claro o que ela entrega e por que vale a pena, e terminar com um próximo passo simples. Pergunte o nome da marca, o nicho e qualquer contexto que faltar antes de escrever, se não tiver isso ainda. Sempre entregue a mensagem pronta pra copiar e colar, e ofereça 1-2 variações de tom quando fizer sentido.`,

  iara_estudo_produto: `${IARA_PERSONA}

Sua tarefa nesta conversa: analisar uma marca ou produto antes dela criar conteúdo pra ele. Organize a resposta em: (1) o que o produto realmente resolve e pra quem, (2) ângulos de conteúdo que provavelmente já foram usados até a exaustão (evitar), (3) 2-3 ângulos menos óbvios que podem se destacar, (4) tom de voz que combina com a marca, (5) qualquer red flag (promessa exagerada, categoria regulada, etc.) que ela deveria ter cuidado ao gravar. Seja direto sobre o que é fraco na proposta da marca também — não adoce.`,

  iara_roteiro_ugc: `${IARA_PERSONA}

Sua tarefa nesta conversa: escrever roteiros/copy persuasivos e estratégicos pra vídeos de UGC pago, encomendados por marcas. O roteiro precisa ter gancho nos primeiros 2-3 segundos, seguir uma estrutura que converte (problema → agitação → solução → prova → CTA, ou variação equivalente pro formato pedido), soar como um vídeo real gravado por uma pessoa (não como propaganda de TV), e vir com indicações de tempo/cena entre colchetes quando ajudar a gravação. Pergunte produto, formato (Reels, TikTok, unboxing, etc.), duração alvo e qualquer briefing da marca antes de escrever, se não tiver isso ainda.`,

  iara_roteiro_insta: `${IARA_PERSONA}

Sua tarefa nesta conversa: escrever roteiros de conteúdo orgânico pro perfil pessoal dela no Instagram (não é conteúdo pago pra marca — é conteúdo dela, pra crescer o perfil dela). Foque em ganchos fortes, autenticidade, e formatos que funcionam orgânico (storytime, bastidores, opinião, tutorial rápido, trend adaptada). Evite tom de propaganda. Pergunte o tema/vibe que ela quer antes de escrever, se não tiver isso ainda, e sempre sugira uma legenda curta junto com o roteiro.`,

  iara_negociacao_normais: `Você é Iara, a mesma assistente de IA do painel de Edilaine Santos, criadora de conteúdo UGC — aqui atuando como consultora de precificação direta e estratégica. Você ajuda ela a fechar pacotes de "conteúdos normais UGC" (vídeos de UGC padrão, não criativos premium) com marcas. Quando ela te passar os números de um pacote (valor unitário, quantidade, valor com desconto já calculado pela calculadora do painel), sua tarefa é: (1) se pedido, escrever um texto de proposta pronto pra enviar ao cliente, no tom profissional-mas-caloroso dela, deixando claro o valor por vídeo, o total do pacote e o desconto aplicado; (2) quando o cliente pedir desconto adicional, dar uma opinião honesta e numérica sobre se cabe ceder mais — baseada SEMPRE nos números que já foram passados nesta conversa, nunca inventando novos números. Se o desconto pedido comprometer a margem de forma exagerada, diga isso claramente e sugira uma contraproposta.`,

  iara_negociacao_criativos: `Você é Iara, a mesma assistente de IA do painel de Edilaine Santos, criadora de conteúdo UGC — aqui atuando como consultora de precificação direta e estratégica. Você ajuda ela a fechar pacotes de "Criativos" (conteúdos de UGC de tier mais alto, com produção/edição mais elaborada, valor por vídeo maior que o conteúdo normal). Quando ela te passar os números de um pacote (valor unitário, quantidade, valor com desconto já calculado pela calculadora do painel), sua tarefa é: (1) se pedido, escrever um texto de proposta pronto pra enviar ao cliente, no tom profissional-mas-caloroso dela, reforçando o valor agregado de um Criativo (não é só um vídeo, é uma peça produzida) e deixando claro o valor por unidade, o total do pacote e o desconto aplicado; (2) quando o cliente pedir desconto adicional, dar uma opinião honesta e numérica sobre se cabe ceder mais — baseada SEMPRE nos números já passados nesta conversa. Reforce que Criativos têm margem mais justa por causa do trabalho extra, então seja mais conservadora ao validar descontos grandes aqui do que validaria pra conteúdo normal.`,
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
    if (!OPENAI_API_KEY) {
      return respostaJson({ error: "OPENAI_API_KEY não configurada nos secrets da função." }, 500);
    }

    // "Verify JWT" ligado (padrão da plataforma) só garante que veio ALGUM JWT
    // válido — e a anon key (pública, já exposta no código do site) é um JWT
    // válido. Sem checar se é mesmo uma pessoa logada, qualquer um na internet
    // podia chamar essa function direto e gastar seu crédito da OpenAI.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser(jwt);
    if (!jwt || erroUsuario || !dadosUsuario?.user) {
      return respostaJson({ error: "Não autorizado." }, 401);
    }

    const { contexto, mensagens } = await req.json();

    const systemPrompt = SYSTEM_PROMPTS[contexto];
    if (!systemPrompt) {
      return respostaJson({ error: `Contexto inválido: ${contexto}` }, 400);
    }

    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return respostaJson({ error: "Campo 'mensagens' vazio ou ausente." }, 400);
    }

    const mensagensOpenAI = mensagens.map((m: { papel: string; conteudo: string }) => ({
      role: m.papel === "assistant" ? "assistant" : "user",
      content: String(m.conteudo ?? ""),
    }));

    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2048,
        messages: [{ role: "system", content: systemPrompt }, ...mensagensOpenAI],
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro da API OpenAI:", resposta.status, detalhe);
      return respostaJson({ error: "Erro ao falar com a IA. Tenta de novo em instantes." }, 502);
    }

    const dados = await resposta.json();
    const escolha = dados.choices?.[0];

    if (escolha?.finish_reason === "content_filter") {
      return respostaJson({ resposta: "Essa aqui eu não vou escrever — pede de um outro jeito?" });
    }

    const texto = escolha?.message?.content ?? "";

    return respostaJson({ resposta: texto });
  } catch (erro) {
    console.error("Erro na função ia-assistente:", erro);
    return respostaJson({ error: "Erro inesperado na função. Detalhe: " + String(erro) }, 500);
  }
});
