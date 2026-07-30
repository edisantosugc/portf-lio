// supabase/functions/ig-media/index.ts
//
// Lista os posts (media) da conta, com miniatura, pra alimentar o seletor
// "Em quais posts" do editor de automação. Chamada pelo painel.html (por
// isso mantém a verificação de JWT do Supabase ligada, como a ia-assistente).

import { GRAPH_BASE, IG_ACCESS_TOKEN, IG_ACCOUNT_ID } from "../_shared/ig.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (!IG_ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    return respostaJson({ error: "IG_ACCESS_TOKEN ou IG_ACCOUNT_ID não configurados nos secrets da função." }, 500);
  }

  try {
    const campos = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url = `${GRAPH_BASE}/${IG_ACCOUNT_ID}/media?fields=${campos}&limit=30&access_token=${
      encodeURIComponent(IG_ACCESS_TOKEN)
    }`;
    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro da Graph API em ig-media:", resposta.status, JSON.stringify(dados));
      return respostaJson({ error: "Não foi possível carregar os posts do Instagram agora." }, 502);
    }

    const posts = (dados.data ?? []).map((m: any) => ({
      id: m.id,
      legenda: (m.caption ?? "").slice(0, 80),
      tipo: m.media_type,
      miniatura: m.thumbnail_url ?? m.media_url,
      link: m.permalink,
      data: m.timestamp,
    }));

    return respostaJson({ posts });
  } catch (erro) {
    console.error("Erro inesperado na função ig-media:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
