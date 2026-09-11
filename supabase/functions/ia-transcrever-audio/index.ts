// supabase/functions/ia-transcrever-audio/index.ts
//
// Recebe um áudio gravado no navegador (campo "audio" num multipart/form-data) e manda
// pro Whisper da OpenAI transcrever em texto, em português. Chamada pelo botão de
// microfone do chat da IAra — cada gravação tem custo de IA, então só roda quando a
// pessoa aperta "parar e transcrever" de propósito. Mantém a verificação de JWT do
// Supabase ligada, como a ia-assistente e a ig-analise-conteudo.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// EDITE AQUI se o site for publicado em outro domínio
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  // "Verify JWT" ligado (padrão da plataforma) só garante que veio ALGUM JWT válido —
  // e a anon key (pública, já exposta no código do site) é um JWT válido. Sem checar se
  // é mesmo uma pessoa logada, qualquer um na internet podia chamar essa function direto
  // e gastar seu crédito da OpenAI.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser(jwt);
  if (!jwt || erroUsuario || !dadosUsuario?.user) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  if (!OPENAI_API_KEY) {
    return respostaJson({ error: "OPENAI_API_KEY não configurada nos secrets da função." }, 500);
  }

  try {
    const formRecebido = await req.formData();
    const arquivo = formRecebido.get("audio");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return respostaJson({ error: "Nenhum áudio recebido." }, 400);
    }

    const formOpenAI = new FormData();
    formOpenAI.append("file", arquivo, arquivo.name || "gravacao.webm");
    formOpenAI.append("model", "whisper-1");
    formOpenAI.append("language", "pt");

    const resposta = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formOpenAI,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro da API OpenAI (transcrição):", resposta.status, detalhe);
      return respostaJson({ error: "Não foi possível transcrever agora. Tenta de novo em instantes." }, 502);
    }

    const dados = await resposta.json();
    return respostaJson({ texto: (dados.text || "").trim() });
  } catch (erro) {
    console.error("Erro inesperado na função ia-transcrever-audio:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
