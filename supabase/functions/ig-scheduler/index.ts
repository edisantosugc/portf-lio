// supabase/functions/ig-scheduler/index.ts
//
// O carteiro: roda via pg_cron a cada 1 minuto. Esvazia a fila de envios
// represados pelo freio (ig_send_queue) e manda os passos agendados com
// atraso (ig_scheduled) que já venceram. Protegida pelo segredo SCHED_SECRET
// (header x-sched-key), porque quem chama é o pg_cron, não uma pessoa logada.

import {
  TEST_IG_ACCOUNTS,
  criarClienteSupabase,
  enviarMensagemDireta,
  enviarPasso,
  enviarRespostaPrivada,
  pegarFichaDeEnvio,
  registrarResultadoDoEnvio,
} from "../_shared/ig.ts";
import type { Automacao } from "../_shared/ig.ts";

const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const supabase = criarClienteSupabase();
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (!SCHED_SECRET || req.headers.get("x-sched-key") !== SCHED_SECRET) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const fila = await processarFila();
  const agendados = await processarAgendados();

  return new Response(JSON.stringify({ fila, agendados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function processarFila() {
  const { data: itens } = await supabase
    .from("ig_send_queue")
    .select("*")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(50);

  let enviados = 0, expirados = 0, aindaNaFila = 0;

  for (const item of itens ?? []) {
    const idadeMs = Date.now() - new Date(item.created_at).getTime();
    // Fora da janela do Instagram pra responder um comentário: desiste
    if (idadeMs > SETE_DIAS_MS) {
      await supabase.from("ig_send_queue").update({ status: "expirado" }).eq("id", item.id);
      expirados++;
      continue;
    }

    const ehContaDeTeste = TEST_IG_ACCOUNTS.includes(item.ig_user_id);
    const temFicha = ehContaDeTeste || (await pegarFichaDeEnvio(supabase));
    if (!temFicha) {
      aindaNaFila++;
      continue;
    }

    const { data: automacao } = await supabase
      .from("ig_automations")
      .select("*")
      .eq("id", item.automation_id)
      .maybeSingle();
    const passo0 = automacao?.flow?.steps?.[0];
    if (!automacao || !passo0) {
      await supabase
        .from("ig_send_queue")
        .update({ status: "erro", last_error: "automação ou passo inicial não encontrado" })
        .eq("id", item.id);
      continue;
    }

    const resultado = await enviarPasso(automacao as Automacao, passo0, (corpo) =>
      enviarRespostaPrivada(item.comment_id, corpo)
    );
    if (!ehContaDeTeste) await registrarResultadoDoEnvio(supabase, resultado.ok, resultado.duro);
    if (resultado.mid) await supabase.from("ig_bot_sends").insert({ mid: resultado.mid }).select().maybeSingle();

    await supabase
      .from("ig_send_queue")
      .update({
        status: resultado.ok ? "enviado" : "erro",
        sent_at: resultado.ok ? new Date().toISOString() : null,
        tentativas: (item.tentativas ?? 0) + 1,
        last_error: resultado.ok ? null : "falha ao enviar pela Graph API",
      })
      .eq("id", item.id);

    await supabase.from("ig_deliveries").insert({
      ig_user_id: item.ig_user_id,
      automation_id: item.automation_id,
      canal: "private_reply",
      tipo: "flow",
      status: resultado.ok ? "ok" : "erro",
    });

    if (resultado.ok) enviados++;
  }

  return { enviados, expirados, aindaNaFila };
}

async function processarAgendados() {
  const agora = new Date().toISOString();
  const { data: itens } = await supabase
    .from("ig_scheduled")
    .select("*")
    .eq("sent", false)
    .lte("send_at", agora)
    .limit(50);

  let enviados = 0;

  for (const item of itens ?? []) {
    const { data: automacao } = await supabase
      .from("ig_automations")
      .select("*")
      .eq("id", item.automation_id)
      .maybeSingle();
    const passo = (automacao?.flow?.steps ?? []).find((s: any) => Number(s.id) === item.step_id);

    if (!automacao || !passo) {
      await supabase.from("ig_scheduled").update({ sent: true }).eq("id", item.id);
      continue;
    }

    const ehContaDeTeste = TEST_IG_ACCOUNTS.includes(item.ig_user_id);
    const temFicha = ehContaDeTeste || (await pegarFichaDeEnvio(supabase));
    if (!temFicha) continue; // tenta de novo no próximo minuto, fica pendente

    const resultado = await enviarPasso(automacao as Automacao, passo, (corpo) =>
      enviarMensagemDireta(item.ig_user_id, corpo)
    );
    if (!ehContaDeTeste) await registrarResultadoDoEnvio(supabase, resultado.ok, resultado.duro);
    if (resultado.mid) await supabase.from("ig_bot_sends").insert({ mid: resultado.mid }).select().maybeSingle();

    await supabase.from("ig_scheduled").update({ sent: true }).eq("id", item.id);
    await supabase.from("ig_deliveries").insert({
      ig_user_id: item.ig_user_id,
      automation_id: item.automation_id,
      canal: "dm",
      tipo: "flow",
      status: resultado.ok ? "ok" : "erro",
    });

    if (resultado.ok) enviados++;
  }

  return { enviados, processados: (itens ?? []).length };
}
