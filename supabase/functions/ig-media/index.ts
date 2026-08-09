// supabase/functions/ig-media/index.ts
//
// Lista os posts (media) da conta. No modo padrão (rápido), traz miniatura,
// legenda, curtidas e comentários, pra alimentar o seletor "Em quais posts"
// do editor de automação. Com "?insights=true", também busca o alcance e os
// salvos de cada post (mais lento, chama a Graph API uma vez por post), pra
// alimentar o ranking de "Melhores posts" da aba Instagram > Análises.
// Chamada pelo painel.html (por isso mantém a verificação de JWT do
// Supabase ligada, como a ia-assistente).

import { GRAPH_BASE, IG_ACCESS_TOKEN, IG_ACCOUNT_ID, criarClienteSupabase } from "../_shared/ig.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Limite de posts pra buscar insights individuais: cada um é uma chamada extra
// à Graph API, então mantemos conservador pra não demorar nem estourar limite.
const LIMITE_POSTS_COM_INSIGHTS = 12;

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

  // "Verify JWT" ligado (padrão da plataforma) só garante que veio ALGUM JWT
  // válido — e a anon key (pública, já exposta no código do site) é um JWT
  // válido. Sem checar se é mesmo uma pessoa logada, qualquer um na internet
  // podia chamar essa function direto e ler os posts/legendas do Instagram.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: dadosUsuario, error: erroUsuario } = await criarClienteSupabase().auth.getUser(jwt);
  if (!jwt || erroUsuario || !dadosUsuario?.user) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  const url = new URL(req.url);
  const comInsights = url.searchParams.get("insights") === "true";

  try {
    const campos = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
    const limite = comInsights ? LIMITE_POSTS_COM_INSIGHTS : 30;
    const mediaUrl = `${GRAPH_BASE}/${IG_ACCOUNT_ID}/media?fields=${campos}&limit=${limite}&access_token=${
      encodeURIComponent(IG_ACCESS_TOKEN)
    }`;
    const resposta = await fetch(mediaUrl);
    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro da Graph API em ig-media:", resposta.status, JSON.stringify(dados));
      return respostaJson({ error: "Não foi possível carregar os posts do Instagram agora." }, 502);
    }

    let posts = (dados.data ?? []).map((m: any) => ({
      id: m.id,
      legenda: (m.caption ?? "").slice(0, 80),
      tipo: m.media_type,
      miniatura: m.thumbnail_url ?? m.media_url,
      link: m.permalink,
      data: m.timestamp,
      curtidas: m.like_count ?? 0,
      comentarios: m.comments_count ?? 0,
      salvos: null as number | null,
      alcance: null as number | null,
      visualizacoes: null as number | null,
    }));

    if (comInsights) {
      posts = await Promise.all(posts.map(async (post) => {
        try {
          // "plays" só existe pra vídeo/reel; "reach" e "saved" servem pra qualquer tipo.
          // Pede os três juntos; se a Graph recusar por causa de uma métrica que não
          // se aplica àquele post, cai no fallback (tenta só reach+saved).
          const metricasCompletas = "reach,saved,plays";
          const metricasBasicas = "reach,saved";
          let insightsUrl = `${GRAPH_BASE}/${post.id}/insights?metric=${metricasCompletas}&access_token=${
            encodeURIComponent(IG_ACCESS_TOKEN)
          }`;
          let respostaInsights = await fetch(insightsUrl);
          if (!respostaInsights.ok) {
            insightsUrl = `${GRAPH_BASE}/${post.id}/insights?metric=${metricasBasicas}&access_token=${
              encodeURIComponent(IG_ACCESS_TOKEN)
            }`;
            respostaInsights = await fetch(insightsUrl);
          }
          if (!respostaInsights.ok) return post;

          const insightsJson = await respostaInsights.json();
          const pegar = (nome: string) => {
            const item = (insightsJson.data ?? []).find((d: any) => d.name === nome);
            return item ? Number(item.values?.[0]?.value ?? 0) : null;
          };
          return {
            ...post,
            alcance: pegar("reach"),
            salvos: pegar("saved"),
            visualizacoes: pegar("plays"),
          };
        } catch (erroPost) {
          console.error("Erro ao buscar insights do post", post.id, ":", erroPost);
          return post;
        }
      }));
    }

    return respostaJson({ posts });
  } catch (erro) {
    console.error("Erro inesperado na função ig-media:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
