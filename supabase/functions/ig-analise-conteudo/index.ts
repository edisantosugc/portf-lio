// supabase/functions/ig-analise-conteudo/index.ts
//
// Lê os comentários recentes (ig_comments) e usa a Anthropic API pra: (1)
// classificar os que são dúvida ou interesse real, com uma sugestão de ação
// pra cada um, e (2) sugerir ideias de vídeo com base nos temas mais
// recorrentes. Chamada pelo painel.html (aba Instagram > Análises), sempre
// por um clique explícito da pessoa (não em todo carregamento de página),
// já que cada chamada tem custo de IA. Mantém a verificação de JWT do
// Supabase ligada, como a ia-assistente.

import { criarClienteSupabase } from "../_shared/ig.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_VERSION = "2023-06-01";
const MODELO = "claude-sonnet-5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você analisa comentários de Instagram de uma criadora de conteúdo que ensina UGC (User Generated Content) e gestão de Instagram.

Você recebe uma lista de comentários recentes (usuário e texto, um por linha). Sua tarefa:

1. Selecione só os comentários que sejam perguntas genuínas ou expressem um interesse real relacionado a algo que ela ensina ou vende. Ignore elogios genéricos sem substância, emojis soltos, spam e comentários irrelevantes.
2. Para cada um selecionado, classifique como "duvida" (pergunta direta) ou "interesse" (expressa vontade ou necessidade sem perguntar direto), e escreva uma sugestão curta (1 frase) do que responder ou fazer a respeito.
3. Com base nos temas mais recorrentes entre todos os comentários (selecionados ou não), sugira até 6 ideias de vídeo, cada uma com um título curto e uma descrição de 1 frase.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, neste formato exato:
{"oportunidades":[{"username":"...","texto":"...","tipo":"duvida","sugestao":"..."}],"ideias":[{"titulo":"...","descricao":"..."}]}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  if (!ANTHROPIC_API_KEY) {
    return respostaJson({ error: "ANTHROPIC_API_KEY não configurada nos secrets da função." }, 500);
  }

  try {
    const supabase = criarClienteSupabase();
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: comentarios, error } = await supabase
      .from("ig_comments")
      .select("username, texto, created_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw error;

    if (!comentarios || comentarios.length === 0) {
      return respostaJson({ oportunidades: [], ideias: [], aviso: "Nenhum comentário registrado nos últimos 30 dias ainda." });
    }

    const listaTexto = comentarios.map((c) => `@${c.username || "desconhecido"}: ${c.texto || ""}`).join("\n");

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        messages: [{ role: "user", content: listaTexto }],
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro da API Anthropic em ig-analise-conteudo:", resposta.status, detalhe);
      return respostaJson({ error: "Erro ao analisar com a IA. Tenta de novo em instantes." }, 502);
    }

    const dadosResposta = await resposta.json();
    if (dadosResposta.stop_reason === "refusal") {
      return respostaJson({ error: "A IA recusou analisar esse conteúdo." }, 200);
    }

    const texto = (dadosResposta.content ?? [])
      .filter((bloco: { type: string }) => bloco.type === "text")
      .map((bloco: { text: string }) => bloco.text)
      .join("\n")
      .trim();

    let json: any;
    try {
      const inicioJson = texto.indexOf("{");
      const fimJson = texto.lastIndexOf("}");
      json = JSON.parse(texto.slice(inicioJson, fimJson + 1));
    } catch (erroParse) {
      console.error("Erro ao interpretar JSON da IA em ig-analise-conteudo:", erroParse, texto);
      return respostaJson({ error: "A IA respondeu num formato inesperado. Tenta de novo." }, 502);
    }

    return respostaJson({
      oportunidades: Array.isArray(json.oportunidades) ? json.oportunidades : [],
      ideias: Array.isArray(json.ideias) ? json.ideias : [],
    });
  } catch (erro) {
    console.error("Erro inesperado na função ig-analise-conteudo:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
