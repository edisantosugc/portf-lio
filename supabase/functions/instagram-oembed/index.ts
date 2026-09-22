// supabase/functions/instagram-oembed/index.ts
//
// Busca a capa de posts/reels do Instagram via oEmbed da Meta, pra usar nos cards da
// sub-aba Transcrição (dentro de Roteiros). Usa o mesmo app "ClaudeDM" já aprovado pras
// automações de Instagram — só com o recurso "Meta oEmbed Read" a mais. O App Secret
// nunca pode aparecer no navegador, por isso essa chamada passa por aqui (o painel
// nunca fala direto com o Graph API da Meta pra isso).
//
// Body esperado: { url: string }  // link do post/reel do Instagram

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_SECRET = Deno.env.get("APP_SECRET") ?? "";

// ID do app "ClaudeDM" — não é segredo (aparece até no painel público da Meta), só o
// APP_SECRET acima é que precisa ficar escondido.
const IG_APP_ID = "1388739559814936";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  // Só quem está logada no painel pode chamar isso.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser(jwt);
  if (!jwt || erroUsuario || !dadosUsuario?.user) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  if (!APP_SECRET) {
    return respostaJson({ error: "APP_SECRET não configurado nos secrets do projeto." }, 500);
  }

  let corpoRequisicao: Record<string, unknown> = {};
  try {
    corpoRequisicao = await req.json();
  } catch (_erro) {
    return respostaJson({ error: "Corpo da requisição inválido." }, 400);
  }

  const url = String(corpoRequisicao?.url ?? "").trim();
  if (!url) {
    return respostaJson({ error: "Falta o link do post/reel." }, 400);
  }

  try {
    const tokenApp = `${IG_APP_ID}|${APP_SECRET}`;
    const resposta = await fetch(
      `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${tokenApp}`,
    );
    const corpo = await resposta.json();

    if (!resposta.ok) {
      return respostaJson({ error: corpo?.error?.message || "O Instagram recusou o pedido." }, resposta.status);
    }

    return respostaJson({ thumbnail_url: corpo?.thumbnail_url ?? null });
  } catch (erroRede) {
    return respostaJson({ error: "Falha ao consultar o Instagram agora." }, 500);
  }
});
