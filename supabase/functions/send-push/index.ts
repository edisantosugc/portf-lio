// supabase/functions/send-push/index.ts
//
// Manda notificação push pro navegador/celular de quem estiver inscrito
// (tabela push_subscricoes). Dois jeitos de chamar:
//
// 1) Direto, de dentro do painel/portal (usuária logada): body como
//    { conta: "di" | "gustavo", titulo, corpo, url }. Usado hoje só pra
//    avisar o Gustavo na hora que a Edi fecha o mês.
//
// 2) Pelo pg_cron, 1x por dia: header x-sched-key = SCHED_SECRET, body
//    vazio ({}). Aí a função mesma decide o que está vencendo/tarefa do
//    dia/pensão e manda pra quem precisar — ver enviarAvisosDiarios().

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SCHED_SECRET = Deno.env.get("SCHED_SECRET") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:edilainesantosugc@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// As mesmas contas fixas/cartões "de sempre" do painel principal — só o
// essencial (nome + dia de vencimento) pra saber quando avisar. Duplicado de
// propósito: é pequeno, estável, e o painel.html já duplica essas mesmas
// constantes em mais de um lugar.
const VENCIMENTO_CARTOES: Record<string, number | null> = {
  "Dígio": 5,
  "Inter": 10,
  "Nubank": 10,
  "Santander": 12,
  "Mercado Pago": 20,
  "Dinheiro/Outro": null,
};
const VENCIMENTO_GASTOS_FIXOS: Record<string, number> = {
  "Aluguel": 10,
  "Água": 15,
  "Luz": 12,
  "TV": 5,
  "Fies": 5,
  "Claro Celular": 8,
  "Vivo Celular": 20,
  "Vivo Internet": 20,
  "D4S CNPJ DI": 20,
  "D4S CNPJ GU": 20,
};

Deno.serve(async (req: Request) => {
  const ehChamadaAgendada = !!SCHED_SECRET && req.headers.get("x-sched-key") === SCHED_SECRET;

  let corpoRequisicao: Record<string, unknown> = {};
  try {
    corpoRequisicao = await req.json();
  } catch (_erro) {
    corpoRequisicao = {};
  }

  if (ehChamadaAgendada) {
    const resultado = await enviarAvisosDiarios();
    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Chamada direta: o Supabase já exige um usuário autenticado antes de
  // deixar a requisição chegar aqui (configuração padrão de Edge Functions).
  const { conta, titulo, corpo, url } = corpoRequisicao as {
    conta?: string; titulo?: string; corpo?: string; url?: string;
  };

  if (!conta || !titulo) {
    return new Response(JSON.stringify({ error: "conta e titulo são obrigatórios" }), { status: 400 });
  }

  const enviados = await mandarPraConta(conta, titulo, corpo ?? "", url ?? "/");
  return new Response(JSON.stringify({ enviados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function mandarPraConta(conta: string, titulo: string, corpo: string, url: string) {
  const { data: inscricoes } = await supabase.from("push_subscricoes").select("*").eq("conta", conta);
  let enviados = 0;
  for (const inscricao of inscricoes ?? []) {
    const ok = await mandarUm(inscricao, titulo, corpo, url);
    if (ok) enviados++;
  }
  return enviados;
}

async function mandarUm(inscricao: any, titulo: string, corpo: string, url: string) {
  const payload = JSON.stringify({ titulo, corpo, url });
  const assinatura = {
    endpoint: inscricao.endpoint,
    keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
  };
  try {
    await webpush.sendNotification(assinatura, payload);
    return true;
  } catch (erro: any) {
    // Inscrição expirada/inválida (o navegador cancelou por fora) — remove
    // pra não ficar tentando pra sempre
    if (erro?.statusCode === 410 || erro?.statusCode === 404) {
      await supabase.from("push_subscricoes").delete().eq("id", inscricao.id);
    } else {
      console.error("Erro enviando push:", erro?.statusCode, erro?.body);
    }
    return false;
  }
}

function mensagemPrazo(dias: number) {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

async function enviarAvisosDiarios() {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const ano = hoje.getFullYear();
  const mes0 = hoje.getMonth(); // 0-11, mesma convenção usada em financas_gastos_fixos
  const dia = hoje.getDate();

  let totalDi = 0;
  let totalGustavo = 0;

  // ---------- Pra ela: cartões vencendo em 3, 1 ou 0 dias, ainda não pagos ----------
  const { data: cartoesPagos } = await supabase
    .from("financas_cartoes_pagos")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes0);
  const cartoesPagosSet = new Set((cartoesPagos ?? []).filter((c: any) => c.pago).map((c: any) => c.cartao));

  for (const [cartao, vencimento] of Object.entries(VENCIMENTO_CARTOES)) {
    if (vencimento === null || cartoesPagosSet.has(cartao)) continue;
    const diasParaVencer = vencimento - dia;
    if ([3, 1, 0].includes(diasParaVencer)) {
      await mandarPraConta("di", `Fatura ${cartao} ${mensagemPrazo(diasParaVencer)}`, "Confere no painel.", "/painel.html");
      totalDi++;
    }
  }

  // ---------- Pra ela: contas fixas vencendo em 3, 1 ou 0 dias, ainda não pagas ----------
  const { data: gastosFixosMes } = await supabase
    .from("financas_gastos_fixos")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes0);
  const gastosFixosPagosSet = new Set((gastosFixosMes ?? []).filter((g: any) => g.pago).map((g: any) => g.nome));

  for (const [nome, vencimento] of Object.entries(VENCIMENTO_GASTOS_FIXOS)) {
    if (gastosFixosPagosSet.has(nome)) continue;
    const diasParaVencer = vencimento - dia;
    if ([3, 1, 0].includes(diasParaVencer)) {
      await mandarPraConta("di", `${nome} ${mensagemPrazo(diasParaVencer)}`, "Confere no painel.", "/painel.html");
      totalDi++;
    }
  }

  // ---------- Pra ela: compromissos de hoje ----------
  const { data: tarefasHoje } = await supabase
    .from("painel_tarefas")
    .select("*")
    .eq("data", hojeISO)
    .eq("concluida", false);
  if ((tarefasHoje ?? []).length > 0) {
    const n = tarefasHoje!.length;
    await mandarPraConta(
      "di",
      `Você tem ${n} compromisso${n === 1 ? "" : "s"} hoje`,
      "Confere sua agenda.",
      "/painel.html"
    );
    totalDi++;
  }

  // ---------- Pro Gustavo: pensão vencendo em 3 dias ou hoje, ainda não paga ----------
  const { data: pensao } = await supabase
    .from("portal_gustavo_pensao")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes0 + 1)
    .maybeSingle();

  if (pensao && !pensao.pago && pensao.vencimento) {
    const diasParaVencerPensao = Math.round(
      (new Date(pensao.vencimento).getTime() - new Date(hojeISO).getTime()) / 86400000
    );
    if (diasParaVencerPensao === 3 || diasParaVencerPensao === 0) {
      const mensagem = diasParaVencerPensao === 0 ? "vence hoje" : "vence em 3 dias";
      await mandarPraConta("gustavo", `Pensão da Lívia ${mensagem}`, "Não esquece de registrar o Pix.", "/gustavo/");
      totalGustavo++;
    }
  }

  return { totalDi, totalGustavo };
}
