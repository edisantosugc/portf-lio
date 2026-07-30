// supabase/functions/ig-insights/index.ts
//
// Puxa da API do Instagram: total de seguidores, novos seguidores por dia
// e alcance por dia (últimos 15 dias), em formato pronto pro dashboard da
// aba Instagram > Métricas do painel. Chamada pelo painel.html (por isso
// mantém a verificação de JWT do Supabase ligada, como a ia-assistente).

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
    const perfilUrl = `${GRAPH_BASE}/${IG_ACCOUNT_ID}?fields=followers_count,username&access_token=${
      encodeURIComponent(IG_ACCESS_TOKEN)
    }`;
    const respostaPerfil = await fetch(perfilUrl);
    const perfil = await respostaPerfil.json();

    if (!respostaPerfil.ok) {
      console.error("Erro da Graph API (perfil) em ig-insights:", respostaPerfil.status, JSON.stringify(perfil));
      return respostaJson({ error: "Não foi possível carregar os seguidores agora." }, 502);
    }

    const since = Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const insightsUrl =
      `${GRAPH_BASE}/${IG_ACCOUNT_ID}/insights?metric=follower_count,reach&period=day&since=${since}&until=${until}&access_token=${
        encodeURIComponent(IG_ACCESS_TOKEN)
      }`;
    const respostaInsights = await fetch(insightsUrl);
    const insights = await respostaInsights.json();

    if (!respostaInsights.ok) {
      console.error(
        "Erro da Graph API (insights) em ig-insights:",
        respostaInsights.status,
        JSON.stringify(insights),
      );
      return respostaJson({
        seguidores: perfil.followers_count ?? null,
        usuario: perfil.username ?? null,
        novosSeguidoresPorDia: [],
        alcancePorDia: [],
        aviso: "Total de seguidores carregado, mas os gráficos por dia falharam.",
      });
    }

    const extrairSerie = (nomeMetrica: string) => {
      const metrica = (insights.data ?? []).find((d: any) => d.name === nomeMetrica);
      return (metrica?.values ?? []).map((v: any) => ({ data: v.end_time, valor: v.value }));
    };

    return respostaJson({
      seguidores: perfil.followers_count ?? null,
      usuario: perfil.username ?? null,
      novosSeguidoresPorDia: extrairSerie("follower_count"),
      alcancePorDia: extrairSerie("reach"),
    });
  } catch (erro) {
    console.error("Erro inesperado na função ig-insights:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
