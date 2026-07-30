// supabase/functions/ig-insights/index.ts
//
// Puxa da API do Instagram: total de seguidores, novos seguidores por dia,
// alcance por dia e contas engajadas, e do nosso próprio banco: interações
// (comentários + DMs) no período. Serve tanto a aba Instagram > Visão geral
// (período fixo de 15 dias) quanto a aba Análises (período escolhido pela
// pessoa: 7, 30, 90 dias ou tudo). Chamada pelo painel.html (por isso mantém
// a verificação de JWT do Supabase ligada, como a ia-assistente).
//
// Nota técnica: a Graph API do Instagram só devolve granularidade DIÁRIA
// (period=day) numa janela de até ~30 dias por chamada. Por isso, pra
// períodos maiores (90 dias/tudo), os GRÁFICOS de seguidores/alcance ficam
// limitados aos últimos 30 dias (com um aviso), mas os cartões de
// "Interações" (que vêm do nosso próprio banco, não da Graph API) respeitam
// o período real escolhido, sem esse limite.

import { GRAPH_BASE, IG_ACCESS_TOKEN, IG_ACCOUNT_ID, criarClienteSupabase } from "../_shared/ig.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const LIMITE_DIAS_GRAPH = 30;

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

  const url = new URL(req.url);
  const diasParam = url.searchParams.get("dias") ?? "15";
  const periodoTudo = diasParam === "tudo";
  const diasSolicitados = periodoTudo ? 365 : (Number(diasParam) || 15);
  const diasGraph = Math.min(diasSolicitados, LIMITE_DIAS_GRAPH);

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

    const since = Math.floor((Date.now() - diasGraph * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const insightsUrl =
      `${GRAPH_BASE}/${IG_ACCOUNT_ID}/insights?metric=follower_count,reach&period=day&since=${since}&until=${until}&access_token=${
        encodeURIComponent(IG_ACCESS_TOKEN)
      }`;
    const respostaInsights = await fetch(insightsUrl);
    const insights = await respostaInsights.json();

    let novosSeguidoresPorDia: { data: string; valor: number }[] = [];
    let alcancePorDia: { data: string; valor: number }[] = [];
    let avisoGraph: string | undefined;

    if (respostaInsights.ok) {
      const extrairSerie = (nomeMetrica: string) => {
        const metrica = (insights.data ?? []).find((d: any) => d.name === nomeMetrica);
        return (metrica?.values ?? []).map((v: any) => ({ data: v.end_time, valor: v.value }));
      };
      novosSeguidoresPorDia = extrairSerie("follower_count");
      alcancePorDia = extrairSerie("reach");
      if (diasSolicitados > LIMITE_DIAS_GRAPH){
        avisoGraph = `Gráficos diários limitados aos últimos ${LIMITE_DIAS_GRAPH} dias (limite da API do Instagram).`;
      }
    } else {
      console.error("Erro da Graph API (insights) em ig-insights:", respostaInsights.status, JSON.stringify(insights));
      avisoGraph = "Gráficos por dia indisponíveis agora.";
    }

    // Contas engajadas: métrica separada e isolada, pra uma falha aqui (ex: métrica não
    // disponível pra esse tipo de conta) não derrubar o resto da resposta.
    let contasEngajadas: number | null = null;
    try {
      const engajadasUrl =
        `${GRAPH_BASE}/${IG_ACCOUNT_ID}/insights?metric=accounts_engaged&period=day&since=${since}&until=${until}&access_token=${
          encodeURIComponent(IG_ACCESS_TOKEN)
        }`;
      const respostaEngajadas = await fetch(engajadasUrl);
      const engajadas = await respostaEngajadas.json();
      if (respostaEngajadas.ok) {
        const valores = engajadas.data?.[0]?.values ?? [];
        contasEngajadas = valores.reduce((soma: number, v: any) => soma + (Number(v.value) || 0), 0);
      }
    } catch (erroEngajadas) {
      console.error("Erro ao buscar contas engajadas em ig-insights:", erroEngajadas);
    }

    // Interações (comentários + DMs) no período REAL escolhido, vindas do nosso próprio
    // banco (sem o limite de 30 dias da Graph API).
    let interacoes = 0;
    try {
      const supabase = criarClienteSupabase();
      const desde = periodoTudo
        ? new Date(0).toISOString()
        : new Date(Date.now() - diasSolicitados * 24 * 60 * 60 * 1000).toISOString();
      const { count: totalComentarios } = await supabase
        .from("ig_comments").select("*", { count: "exact", head: true }).gte("created_at", desde);
      const { count: totalEnvios } = await supabase
        .from("ig_deliveries").select("*", { count: "exact", head: true }).gte("ts", desde);
      interacoes = (totalComentarios || 0) + (totalEnvios || 0);
    } catch (erroInteracoes) {
      console.error("Erro ao contar interações em ig-insights:", erroInteracoes);
    }

    return respostaJson({
      seguidores: perfil.followers_count ?? null,
      usuario: perfil.username ?? null,
      novosSeguidoresPorDia,
      alcancePorDia,
      contasEngajadas,
      interacoes,
      diasUsados: diasGraph,
      aviso: avisoGraph,
    });
  } catch (erro) {
    console.error("Erro inesperado na função ig-insights:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
