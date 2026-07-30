// supabase/functions/ig-token-refresh/index.ts
//
// Roda via pg_cron cerca de 1x por semana. Renova o token de acesso de
// longa duração (~60 dias) chamando o endpoint de refresh do Instagram
// (SEM a versão no caminho, ao contrário das outras chamadas da Graph API)
// e grava a nova validade em ig_token_status. Protegida pelo segredo
// SCHED_SECRET (header x-sched-key).
//
// Nota: pelo comportamento documentado da Meta, esse endpoint costuma
// devolver o MESMO valor de token, só com a validade estendida (não gera
// um token novo pra copiar em outro lugar). Se algum dia isso mudar e o
// token parar de funcionar mesmo com last_ok = true aqui, gere um token
// novo manualmente no Meta for Developers e atualize o secret IG_ACCESS_TOKEN.

import { criarClienteSupabase } from "../_shared/ig.ts";

const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const IG_ACCESS_TOKEN = Deno.env.get("IG_ACCESS_TOKEN") ?? "";
const supabase = criarClienteSupabase();

Deno.serve(async (req: Request) => {
  if (!SCHED_SECRET || req.headers.get("x-sched-key") !== SCHED_SECRET) {
    return new Response("Não autorizado.", { status: 401 });
  }

  if (!IG_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ ok: false, erro: "IG_ACCESS_TOKEN não configurado." }), { status: 500 });
  }

  try {
    const url =
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${
        encodeURIComponent(IG_ACCESS_TOKEN)
      }`;
    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!resposta.ok) {
      await supabase
        .from("ig_token_status")
        .update({ last_ok: false, last_error: JSON.stringify(dados), updated_at: new Date().toISOString() })
        .eq("id", "main");
      return new Response(JSON.stringify({ ok: false, erro: dados }), { status: 502 });
    }

    const expiraEm = dados.expires_in
      ? new Date(Date.now() + Number(dados.expires_in) * 1000).toISOString()
      : null;

    await supabase
      .from("ig_token_status")
      .update({
        last_ok: true,
        last_error: null,
        expires_at: expiraEm,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    return new Response(JSON.stringify({ ok: true, expires_at: expiraEm }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (erro) {
    console.error("Erro ao renovar o token do Instagram:", erro);
    await supabase
      .from("ig_token_status")
      .update({ last_ok: false, last_error: String(erro), updated_at: new Date().toISOString() })
      .eq("id", "main");
    return new Response(JSON.stringify({ ok: false, erro: String(erro) }), { status: 500 });
  }
});
