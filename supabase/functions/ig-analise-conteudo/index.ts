// supabase/functions/ig-analise-conteudo/index.ts
//
// Lê os comentários recentes (ig_comments) e usa a OpenAI API pra: (1) classificar os
// que são dúvida ou interesse real, com uma sugestão de ação pra cada um; (2) sugerir
// ideias de vídeo cruzando comentários, a Memória (análise de perfil) e pautas em alta
// pesquisadas na web; e (3) montar um relatório comparando posts recentes (métricas,
// mandadas pelo painel.html no corpo da chamada) com a análise de perfil. Chamada pelo
// painel.html (aba Instagram > Análises), sempre por um clique explícito da pessoa (não
// em todo carregamento de página), já que cada chamada tem custo de IA. Mantém a
// verificação de JWT do Supabase ligada, como a ia-assistente.

import { createClient } from "npm:@supabase/supabase-js@2";

// Cliente do Supabase montado aqui mesmo (em vez de importar de _shared/ig.ts):
// essa função foi criada direto pelo editor do site da Supabase, que não enxerga
// arquivos fora da própria pasta da função, então ela precisa ser autossuficiente.
function criarClienteSupabase() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODELO = "gpt-4o-mini";

// EDITE AQUI se quiser aumentar/diminuir quanto da Memória entra no prompt —
// mesmo limite usado em ia-assistente, pra não disparar o tamanho/custo da chamada.
const MEMORIA_LIMITE_CARACTERES = 8000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://edilainesantos.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Recebe a Memória da IAra, as pautas em alta pesquisadas na internet (ambas já
// formatadas, ou "" se vazias) e a data de hoje, e monta o system prompt na hora — o
// modelo não sabe a data atual sozinho, e sem dizer explicitamente ele tende a "puxar"
// anos/tendências do próprio treinamento (ex.: sugerir algo "em 2023") em vez de ficar
// só no que os comentários/documentos mostram.
function montarSystemPrompt(dataHojeExtenso: string, blocoMemoria: string, blocoPautasQuentes: string, blocoPosts: string): string {
  return `Você analisa comentários e posts de Instagram de uma criadora de conteúdo que ensina UGC (User Generated Content) e gestão de Instagram.

Hoje é ${dataHojeExtenso}. Nunca mencione um ano diferente desse (nem anos passados tipo "2023").
${blocoMemoria ? `\nContexto sobre a marca pessoal, o posicionamento e a estrutura de roteiro que ela já definiu — use isso como base FIXA pras ideias de vídeo e pro relatório de desempenho, mesmo quando os comentários abaixo forem poucos ou genéricos. Preste atenção especial em qualquer seção tipo "o que evitar": nunca sugira algo listado ali, e sinalize no relatório se algum post recente cair nesses pontos.\n${blocoMemoria}\n` : ""}
${blocoPautasQuentes ? `\nPautas em alta agora (pesquisadas na internet) nos nichos de UGC, criação de conteúdo e desenvolvimento pessoal/carreira pra mulheres:\n${blocoPautasQuentes}\n` : ""}
${blocoPosts ? `\nPosts recentes publicados por ela, com legenda e métricas de desempenho (curtidas, comentários, salvos, alcance/visualizações) — um por linha:\n${blocoPosts}\n` : ""}
Você recebe uma lista de comentários recentes (usuário e texto, um por linha) — pode vir vazia ou com poucos comentários úteis, isso é normal e não deve travar a análise. Sua tarefa:

1. Selecione só os comentários que sejam perguntas genuínas ou expressem um interesse real relacionado a algo que ela ensina ou vende. Ignore elogios genéricos sem substância, emojis soltos, spam e comentários irrelevantes.
2. Para cada um selecionado, classifique como "duvida" (pergunta direta) ou "interesse" (expressa vontade ou necessidade sem perguntar direto), e escreva uma sugestão curta (1 frase) do que responder ou fazer a respeito.
3. Sugira até 8 ideias de vídeo, sempre devolvendo PELO MENOS 3 no total — mesmo sem nenhum comentário aproveitável — combinando até três origens:
   - "comentario": baseada em tema realmente recorrente nos comentários recebidos (só use essa origem se os comentários sustentarem de verdade).
   - "perfil": baseada no posicionamento, tom de voz, estrutura de roteiro ou estratégias de feed (Série, Virais, UGC → Autoridade etc.) da análise de perfil dela, acima.
   - "tendencia": baseada nas pautas em alta pesquisadas na internet, acima, adaptada pro nicho e tom dela — só use se a pauta tiver relação de verdade com UGC/criação de conteúdo/desenvolvimento pessoal feminino. Ignore qualquer pauta genérica de comércio/data comemorativa/produto sazonal que tenha vindo na lista sem essa relação.
   Cada ideia tem, além de título curto e descrição de 1 frase:
   - "origem": marcando de qual das três acima ela veio.
   - "nicho": o assunto/tema principal da ideia, curto (1-3 palavras) — ex: "UGC", "Desenvolvimento pessoal", "Autoconhecimento", "Finanças", "Gestão de Instagram", ou outro tema que caiba melhor.
   - "tipoConteudo": qual das quatro estratégias de conteúdo da análise de perfil essa ideia serve melhor — "Autoridade" (reforça ela como referência/mentora, prova técnica ou de resultado), "Conexão" (aproxima, gera identificação, storytelling pessoal), "Viral" (gancho forte pra alcance, formato leve/compartilhável), ou "Série" (conteúdo educativo recorrente, parte de uma sequência). Ela vai usar essa ideia pra gravar o vídeo da semana, então esses dois campos (nicho e tipoConteudo) precisam ficar claros e curtos, prontos pra ela bater o olho e saber do que se trata antes mesmo de ler a descrição.
4. Monte um "relatorioPerfil" cruzando os posts recentes (acima) com a análise de perfil (acima), em 4 listas de itens curtos (1 frase cada, sem enrolação):
   - "certo": o que está dando certo — conteúdos/temas/formatos que performaram bem E estão alinhados com a análise. Diga pra continuar/replicar.
   - "errado": o que não está dando certo — conteúdos que performaram mal, com uma hipótese do porquê (cruzando com a análise quando der).
   - "foraDoPosicionamento": práticas ou conteúdos atuais que contrariam a análise de perfil (ex: pontos do "Exorcismo da mentora Edi"), independente de terem performado bem ou mal.
   - "precisaMelhorar": recomendações práticas e específicas de ajuste, cruzando desempenho real com a análise.
   Se não tiver posts suficientes pra alguma dessas listas, devolva ela como array vazio em vez de inventar — não force conteúdo sem base real. Se não houver NENHUM post na lista de posts recentes, todas as quatro listas vêm vazias.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, neste formato exato:
{"oportunidades":[{"username":"...","texto":"...","tipo":"duvida","sugestao":"..."}],"ideias":[{"titulo":"...","descricao":"...","origem":"perfil","nicho":"Desenvolvimento pessoal","tipoConteudo":"Conexão"}],"relatorioPerfil":{"certo":["..."],"errado":["..."],"foraDoPosicionamento":["..."],"precisaMelhorar":["..."]}}`;
}

// Pesquisa na internet (via OpenAI Responses API + ferramenta de busca web) os assuntos
// mais quentes agora nos nichos dela. Se der qualquer erro (conta sem acesso à busca,
// resposta em formato inesperado etc.), devolve "" — a análise continua funcionando
// normalmente sem a parte de tendências, só não mostra essa origem específica.
async function buscarPautasQuentes(dataHojeExtenso: string): Promise<string> {
  try {
    const resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODELO,
        tools: [{ type: "web_search_preview" }],
        input: `Hoje é ${dataHojeExtenso}. Pesquise na internet quais assuntos estão MAIS EM ALTA agora especificamente nos nichos de: UGC (User Generated Content) pago pra marcas, criação de conteúdo/gestão de Instagram, e desenvolvimento pessoal e carreira para mulheres. NÃO traga assuntos genéricos de "em alta no comércio/consumo" (datas comemorativas, produtos sazonais, promoções) nem de outros nichos só porque estão em alta no geral — só o que é realmente sobre criação de conteúdo, UGC, redes sociais ou desenvolvimento pessoal/carreira feminina. Se não achar nada relevante o suficiente pra algum desses temas, prefira listar menos itens (pode ser só 1 ou 2) a forçar um assunto que não tem relação nenhuma. Liste no máximo 5 pautas reais e atuais (nada inventado), cada uma em uma linha, no formato "Título curto — por que está em alta agora (1 frase)". Responda só a lista, sem introdução nem conclusão.`,
      }),
    });

    if (!resposta.ok) {
      console.error("Erro da API OpenAI (busca de pautas quentes):", resposta.status, await resposta.text());
      return "";
    }

    const dados = await resposta.json();
    if (!dados || !Array.isArray(dados.output)) return "";
    const mensagem = dados.output.find((o: any) => o.type === "message");
    if (!mensagem || !Array.isArray(mensagem.content)) return "";
    return mensagem.content
      .filter((c: any) => c.type === "output_text" && c.text)
      .map((c: any) => c.text)
      .join("\n")
      .trim();
  } catch (erro) {
    console.error("Erro inesperado ao buscar pautas quentes:", erro);
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  const supabase = criarClienteSupabase();

  // "Verify JWT" ligado (padrão da plataforma) só garante que veio ALGUM JWT
  // válido — e a anon key (pública, já exposta no código do site) é um JWT
  // válido. Sem checar se é mesmo uma pessoa logada, qualquer um na internet
  // podia chamar essa function direto e gastar seu crédito da OpenAI.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: dadosUsuario, error: erroUsuario } = await supabase.auth.getUser(jwt);
  if (!jwt || erroUsuario || !dadosUsuario?.user) {
    return respostaJson({ error: "Não autorizado." }, 401);
  }

  if (!OPENAI_API_KEY) {
    return respostaJson({ error: "OPENAI_API_KEY não configurada nos secrets da função." }, 500);
  }

  // Posts recentes com métricas, já buscados pelo painel.html (aba Instagram > Análises)
  // via ig-media?insights=true — reaproveita esse mesmo dado em vez de buscar de novo
  // aqui (evitaria uma segunda leva de chamadas à Graph API do Instagram por post).
  let postsRecebidos: any[] = [];
  try {
    const corpo = await req.json();
    if (Array.isArray(corpo?.posts)) postsRecebidos = corpo.posts;
  } catch {
    // corpo vazio/ausente é válido (chamada antiga, ou sem posts carregados ainda)
  }

  try {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: comentarios, error } = await supabase
      .from("ig_comments")
      .select("username, texto, created_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw error;

    // Sem comentário nenhum não trava mais a análise — a lista pode ficar vazia aqui,
    // e as ideias vêm da Memória (análise de perfil) e das pautas quentes mais abaixo.
    const listaTexto = (comentarios && comentarios.length > 0)
      ? comentarios.map((c: { username: string; texto: string }) => `@${c.username || "desconhecido"}: ${c.texto || ""}`).join("\n")
      : "(nenhum comentário registrado nos últimos 30 dias)";

    // Mesma Memória (marca pessoal, tom de voz, nicho, análise de perfil) usada no chat
    // da IAra — assim as ideias saem no nicho/tom certo, e a seção nunca fica vazia só
    // porque faltou comentário: a análise de perfil já dá conteúdo suficiente sozinha.
    const { data: documentos } = await supabase
      .from("painel_iara_documentos")
      .select("nome, conteudo")
      .order("created_at", { ascending: false });

    let blocoMemoria = "";
    if (documentos && documentos.length > 0) {
      blocoMemoria = documentos.map((d: { nome: string; conteudo: string }) => `### ${d.nome}\n${d.conteudo}`).join("\n\n");
      if (blocoMemoria.length > MEMORIA_LIMITE_CARACTERES) {
        blocoMemoria = blocoMemoria.slice(0, MEMORIA_LIMITE_CARACTERES) + "\n\n[conteúdo cortado — Memória maior do que o limite configurado]";
      }
    }

    const dataHojeExtenso = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

    // Pautas quentes pesquisadas na internet (ver buscarPautasQuentes). Se a busca falhar
    // por qualquer motivo, blocoPautasQuentes fica "" e o prompt final simplesmente não
    // menciona essa origem, sem quebrar o resto da análise.
    const blocoPautasQuentes = await buscarPautasQuentes(dataHojeExtenso);

    // Só os campos que importam pro relatório, e um limite generoso de posts (o
    // painel.html já manda no máximo os mais recentes) pra não estourar o prompt.
    const blocoPosts = postsRecebidos.slice(0, 30).map((p: any) => {
      const metricas = [
        p.curtidas != null ? `${p.curtidas} curtidas` : null,
        p.comentarios != null ? `${p.comentarios} comentários` : null,
        p.salvos != null ? `${p.salvos} salvos` : null,
        (p.visualizacoes ?? p.alcance) != null ? `${p.visualizacoes ?? p.alcance} alcance/visualizações` : null,
      ].filter(Boolean).join(", ");
      const data = p.data ? String(p.data).slice(0, 10) : "";
      return `- [${data}] "${(p.legenda || "(sem legenda)").replace(/\n/g, " ")}" — ${metricas || "sem métricas"}`;
    }).join("\n");

    const systemPrompt = montarSystemPrompt(dataHojeExtenso, blocoMemoria, blocoPautasQuentes, blocoPosts);

    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: listaTexto },
        ],
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro da API OpenAI em ig-analise-conteudo:", resposta.status, detalhe);
      return respostaJson({ error: "Erro ao analisar com a IA. Tenta de novo em instantes." }, 502);
    }

    const dadosResposta = await resposta.json();
    const escolha = dadosResposta.choices?.[0];
    if (escolha?.finish_reason === "content_filter") {
      return respostaJson({ error: "A IA recusou analisar esse conteúdo." }, 200);
    }

    const texto = (escolha?.message?.content ?? "").trim();

    let json: any;
    try {
      const inicioJson = texto.indexOf("{");
      const fimJson = texto.lastIndexOf("}");
      json = JSON.parse(texto.slice(inicioJson, fimJson + 1));
    } catch (erroParse) {
      console.error("Erro ao interpretar JSON da IA em ig-analise-conteudo:", erroParse, texto);
      return respostaJson({ error: "A IA respondeu num formato inesperado. Tenta de novo." }, 502);
    }

    const relatorioBruto = json.relatorioPerfil && typeof json.relatorioPerfil === "object" ? json.relatorioPerfil : {};
    const relatorioPerfil = {
      certo: Array.isArray(relatorioBruto.certo) ? relatorioBruto.certo : [],
      errado: Array.isArray(relatorioBruto.errado) ? relatorioBruto.errado : [],
      foraDoPosicionamento: Array.isArray(relatorioBruto.foraDoPosicionamento) ? relatorioBruto.foraDoPosicionamento : [],
      precisaMelhorar: Array.isArray(relatorioBruto.precisaMelhorar) ? relatorioBruto.precisaMelhorar : [],
    };

    return respostaJson({
      oportunidades: Array.isArray(json.oportunidades) ? json.oportunidades : [],
      ideias: Array.isArray(json.ideias) ? json.ideias : [],
      relatorioPerfil,
      aviso: (!comentarios || comentarios.length === 0)
        ? "Sem comentários novos nos últimos 30 dias — as ideias abaixo vêm da sua análise de perfil e de pautas em alta no nicho."
        : undefined,
    });
  } catch (erro) {
    console.error("Erro inesperado na função ig-analise-conteudo:", erro);
    return respostaJson({ error: "Erro inesperado. Detalhe: " + String(erro) }, 500);
  }
});
