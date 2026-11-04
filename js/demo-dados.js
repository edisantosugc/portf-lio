/* =========================================================================
   js/demo-dados.js — DADOS FICTÍCIOS da demonstração (edilainesantos.com/demo)

   Só é usado quando js/demo.js está ativo (modo demo). Tudo aqui é inventado:
   criadora, marcas, pessoas, e-mails e valores. As datas são sempre relativas
   ao dia de hoje, então a demo nunca fica "velha" (mês atual sempre com
   movimento, follow ups do dia etc.). Pra mudar os dados de exemplo, edite
   aqui; a demo gera tudo de novo a cada dia (ou em /demo?reset).
   ========================================================================= */
(function(){
  "use strict";
  if (!window.EDI_DEMO) return;

  // Números "aleatórios" mas iguais pro mesmo dia (a demo não muda a cada F5)
  function criarSorteio(semente){
    let a = semente >>> 0;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const HOJE = new Date(); HOJE.setHours(12, 0, 0, 0);
  const dia = (deslocamento) => { const d = new Date(HOJE); d.setDate(d.getDate() + deslocamento); return iso(d); };
  const momento = (deslocamentoDias, hora = 10, minuto = 0) => { const d = new Date(HOJE); d.setDate(d.getDate() + deslocamentoDias); d.setHours(hora, minuto, 0, 0); return d.toISOString(); };
  const primeiroDoMes = (desloc) => { const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + desloc, 1, 12); return iso(d); };
  const anoMes = (desloc) => { const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + desloc, 1); return { ano: d.getFullYear(), mes: d.getMonth() }; };
  const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  // Miniaturas desenhadas (sem foto de ninguém): gradiente + título
  function miniatura(texto, cor1, cor2, emoji){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor1}"/><stop offset="1" stop-color="${cor2}"/></linearGradient></defs><rect width="360" height="640" fill="url(#g)"/><text x="180" y="300" font-size="96" text-anchor="middle">${emoji || ""}</text><text x="180" y="400" font-family="Arial" font-weight="700" font-size="30" fill="#fff" text-anchor="middle">${texto}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const MARCAS = [
    ["Aurora Skin", "Beleza", "Sérum facial", 48200], ["Pé de Coco Fit", "Moda Fitness", "Legging", 22100],
    ["Casa Tília", "Casa e Decoração", "Jogo de cama", 61300], ["Brisa Pet", "Pet", "Petisco natural", 33900],
    ["Nuvem Colchões", "Casa e Decoração", "Colchão", 87400], ["Grão Vivo", "Alimentação", "Granola", 15800],
    ["Lume Cosméticos", "Beleza", "Protetor solar", 129000], ["Vértice Tech", "Tech", "Fone bluetooth", 54700],
    ["Ateliê Ipê", "Moda", "Bolsa de couro", 9800], ["Sol de Café", "Alimentação", "Café especial", 27600],
    ["Maré Moda Praia", "Moda", "Biquíni", 41200], ["Bambu Casa", "Casa e Decoração", "Organizadores", 18900],
    ["Fiora Joias", "Moda", "Brinco folheado", 73500], ["Trilha Outdoor", "Esporte", "Mochila", 12400],
    ["Nutri Bem Já", "Saúde", "Suplemento", 38800], ["Mimo Baby", "Infantil", "Body de algodão", 25300],
    ["Ondina Cabelos", "Beleza", "Máscara capilar", 66100], ["Pixel Fone", "Tech", "Carregador portátil", 19700],
    ["Raiz Natural", "Saúde", "Chá detox", 14200], ["Doce Lar Decor", "Casa e Decoração", "Vela aromática", 8600],
    ["Zênite Óculos", "Moda", "Óculos de sol", 52900], ["Cacau da Serra", "Alimentação", "Chocolate 70%", 21800],
    ["Leve Fitness", "Moda Fitness", "Top esportivo", 30500], ["Luar Pijamas", "Moda", "Pijama", 17300],
    ["Toque Pele", "Beleza", "Hidratante", 44800], ["Garra Pet", "Pet", "Brinquedo", 11900],
    ["Capim Limão Spa", "Saúde", "Óleo de massagem", 7400], ["Cerne Móveis", "Casa e Decoração", "Poltrona", 23600],
    ["Nuance Make", "Beleza", "Base líquida", 98200], ["Bossa Bags", "Moda", "Mochila notebook", 16400],
    ["Seiva Óleos", "Beleza", "Óleo corporal", 13100], ["Tom Pastel Papelaria", "Papelaria", "Planner", 34700],
    ["Kiko Kids", "Infantil", "Tênis infantil", 28900], ["Faro Perfumes", "Beleza", "Perfume", 57300],
    ["Vela Viva Aromas", "Casa e Decoração", "Difusor", 9900], ["Folha Verde Chás", "Alimentação", "Chá gelado", 12800]
  ];
  const CONTATOS = ["Juliana Prado", "Marcos Lima", "Carla Torres", "Renata Alves", "Pedro Sales", "Fernanda Rocha", "Thiago Mendes", "Larissa Gomes", "Bruno Castro", "Patrícia Nogueira", "Rodrigo Pires", "Camila Duarte", "Aline Freitas", "Diego Martins", "Natália Ribeiro", "Vinícius Costa"];

  // Pedido dela: nada de nomes, nem inventados — marcas e pessoas viram example01, example02...
  // (numeração fixa: marcas primeiro, depois contatos, perfis do Instagram e pessoas da casa).
  const USUARIOS_IG = ["mari.fit", "ju_skincare", "casa.da.lu", "pedro.reviews", "nina.makes", "rafa.cozinha", "bela.decor", "tati.pet", "leo.tech", "duda.moda", "gabi.viagens", "caio.treino", "lia.beauty", "vivi.home", "nando.cafe"];
  const NOMES_EM_ORDEM = MARCAS.map(m => m[0]).concat(["Pratinha Joias", "Ritmo Esportes"], CONTATOS, USUARIOS_IG);
  const NUMERO_DO_NOME = new Map(NOMES_EM_ORDEM.map((n, i) => [n, i + 1]));
  const exemplo = (nome) => {
    const n = NUMERO_DO_NOME.get(nome);
    return n ? "example" + pad(n) : nome;
  };
  window.EDI_DEMO.exemplo = exemplo;
  // Mesma troca, num texto solto (usado no portfólio/biosite de exemplo)
  window.EDI_DEMO.trocarNomesTexto = (t) => {
    if (typeof t !== "string" || t.startsWith("data:")) return t;
    let x = t;
    NOMES_EM_ORDEM.slice().sort((a2, b2) => b2.length - a2.length).forEach(nome => { if (x.includes(nome)) x = x.split(nome).join(exemplo(nome)); });
    return x;
  };

  // Troca todos os nomes (e os pedaços deles em e-mail/@/site) dentro dos dados gerados
  function trocarNomesPorExemplo(tabelas){
    let texto = JSON.stringify(tabelas);
    const nomes = NOMES_EM_ORDEM.slice().sort((a, b) => b.length - a.length);
    const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nomes.forEach(nome => {
      const ex = exemplo(nome);
      texto = texto.replace(new RegExp(escapar(nome), "g"), ex);
      const sl = slug(nome);
      if (sl.length > 3) texto = texto.replace(new RegExp(escapar(sl), "gi"), ex);
      const primeiro = slug(nome.split(" ")[0]);
      if (nome.includes(" ") && CONTATOS.includes(nome) && primeiro.length > 3) texto = texto.replace(new RegExp("\\b" + escapar(primeiro) + "@", "gi"), ex + "@");
    });
    // domínios reservados pra exemplo (não pertencem a ninguém)
    texto = texto.replace(/@([a-z0-9]+)\.com\.br/gi, "@$1.example.com").replace(/https?:\/\/www\.([a-z0-9]+)\.com\.br/gi, "https://$1.example.com");
    texto = texto.replace(/Indicação da Carla/g, "Indicação de " + exemplo("Carla Torres"));
    return JSON.parse(texto);
  }

  window.EDI_DEMO_GERAR_DADOS = function({ uuid }){
    const r = criarSorteio(Number(iso(HOJE).replace(/-/g, "")));
    const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
    const escolher = (lista) => lista[Math.floor(r() * lista.length)];
    const T = {};
    const add = (t, linha) => { (T[t] = T[t] || []).push(linha); return linha; };

    // ------------------------------------------------------------------ Marcas + Abordagens
    const statusMarcas = [
      ...Array(6).fill("a_enviar"), ...Array(9).fill("enviado"), ...Array(7).fill("follow_up"),
      "respondeu", "respondeu", "proposta", "andamento", "andamento", "contato_futuro", "contato_futuro",
      "fechado", "fechado", "fechado", "sem_retorno", "sem_interesse", "a_enviar"
    ];
    const marcas = [];
    MARCAS.forEach(([nome, nicho, produto, seguidores], i) => {
      const s = slug(nome);
      const status = statusMarcas[i % statusMarcas.length];
      // datas pensadas pros cards: algumas "Enviado" há 7+ dias, algumas "Follow up" há 14+ dias
      let dataEnvio = dia(-entre(1, 5));
      if (status === "enviado") dataEnvio = dia(i % 2 ? -entre(8, 11) : (i % 4 === 0 ? 0 : -entre(2, 5)));
      if (status === "follow_up") dataEnvio = dia(-entre(14, 20));
      if (["respondeu", "proposta", "andamento", "fechado", "sem_retorno", "sem_interesse", "contato_futuro"].includes(status)) dataEnvio = dia(-entre(16, 40));
      const m = add("painel_marcas", {
        id: uuid(), nome, site: `https://www.${s}.com.br`, instagram: `@${s}`, seguidores, email: `contato@${s}.com.br`,
        whatsapp: null, contato: i % 3 === 0 ? CONTATOS[i % CONTATOS.length] : null, nicho, produto,
        origem: escolher(["Instagram", "Google", "TikTok", "Indicação"]), status, observacao: null,
        data: status === "a_enviar" ? dia(-entre(0, 6)) : dataEnvio, prioridade: i % 7 === 0, selecionada: false,
        created_at: momento(-entre(20, 60))
      });
      marcas.push(m);
    });

    const MAPA_STATUS = { enviado: "realizada", follow_up: "follow_up", respondeu: "respondeu", proposta: "proposta", andamento: "andamento", contato_futuro: "contato_futuro", fechado: "fechada", sem_retorno: "sem_retorno", sem_interesse: "sem_interesse" };
    const textosAbordagem = [
      "E-mail de prospecção: Ideia de vídeo pro lançamento da coleção",
      "E-mail de prospecção: Criativos pra Black Friday",
      "E-mail de prospecção: 3 ganchos pro seu produto mais vendido",
      "DM no Instagram com a ideia do vídeo e o link do portfólio"
    ];
    marcas.forEach((m, i) => {
      if (m.status === "a_enviar") return;
      const st = MAPA_STATUS[m.status];
      let followup = dia(7 + (Date.parse(m.data) - Date.parse(iso(HOJE))) / 86400000);
      let feito = false;
      if (st === "follow_up") followup = dia(-entre(0, 4));
      if (st === "andamento" || st === "proposta") followup = i % 2 ? dia(-entre(1, 3)) : dia(entre(2, 5));
      if (st === "contato_futuro") followup = i % 2 ? dia(-1) : dia(entre(30, 80));
      if (["fechada", "sem_retorno", "sem_interesse", "respondeu"].includes(st)) feito = true;
      const ab = add("painel_abordagens", {
        id: uuid(), marca: m.nome, produto: m.produto, nicho: m.nicho, abordagem: null, status: st,
        data_abordagem: m.data, data_followup: followup, followup_feito: feito,
        observacao: textosAbordagem[i % textosAbordagem.length], canal: i % 4 === 3 ? "instagram" : "email",
        canal_detalhe: i % 4 === 3 ? m.instagram : m.email, arquivado: false, marca_origem_id: m.id,
        created_at: momento(Math.round((Date.parse(m.data) - Date.parse(iso(HOJE))) / 86400000))
      });
      if (["respondeu", "proposta", "andamento", "fechado"].includes(m.status)){
        add("painel_marcas_notas", { id: uuid(), marca_id: m.id, data: dia(-entre(5, 12)), texto: escolher(["Respondeu pedindo mídia kit, enviei portfólio e valores.", "Pediu proposta pra 2 vídeos, mandei os pacotes.", "Gostou da ideia, vai alinhar com o time de marketing."]), created_at: momento(-8) });
        add("painel_abordagens_notas", { id: uuid(), abordagem_id: ab.id, data: dia(-entre(1, 4)), texto: escolher(["Mandei e-mail perguntando se conseguiram avaliar a proposta.", "Chamada marcada pra quinta às 15h.", "Enviaram o briefing, vou montar o roteiro."]), created_at: momento(-2) });
      }
    });
    // 1 abordagem criada à mão + 1 rascunho parado
    add("painel_abordagens", { id: uuid(), marca: "Pratinha Joias", produto: "Colar de prata", nicho: "Moda", status: "realizada", data_abordagem: dia(-9), data_followup: dia(-2), followup_feito: false, observacao: "Indicação da Carla, mandei e-mail com a ideia.", canal: "email", canal_detalhe: "marketing@pratinhajoias.com.br", arquivado: false, created_at: momento(-9) });
    add("painel_abordagens", { id: uuid(), marca: "Ritmo Esportes", produto: "Tênis de corrida", nicho: "Esporte", status: "rascunho", data_rascunho: dia(-5), arquivado: false, followup_feito: false, created_at: momento(-5) });

    // ------------------------------------------------------------------ E-mails enviados
    marcas.filter(m => m.status !== "a_enviar").slice(0, 22).forEach((m, i) => {
      add("email_envios", {
        id: uuid(), email: m.email, assunto: escolher(["Uma ideia de vídeo pra " + m.nome, "Criativos pra Black Friday", "Vi o lançamento de vocês e pensei nisso"]),
        status: "ok", status_entrega: i % 9 === 4 ? "bounced" : "entregue", erro: null,
        corpo_html: `<p>Oi, equipe ${m.nome}! Tudo bem?</p><p>Sou a Bia, criadora de conteúdo UGC...</p>`,
        created_at: momento(Math.round((Date.parse(m.data) - Date.parse(iso(HOJE))) / 86400000), 9 + (i % 8), (i * 7) % 60)
      });
    });

    // ------------------------------------------------------------------ Clientes
    const clientes = [
      ["Aurora Skin", "Beleza", "contatos", true], ["Nuvem Colchões", "Casa e Decoração", "abordagem", true],
      ["Lume Cosméticos", "Beleza", "contatos", true], ["Sol de Café", "Alimentação", "contatos", true],
      ["Fiora Joias", "Moda", "historico", true], ["Vértice Tech", "Tech", "contatos", false],
      ["Ondina Cabelos", "Beleza", "abordagem", false], ["Cacau da Serra", "Alimentação", "contatos", true]
    ].map(([nome, nicho, etapa, trabalhou], i) => add("painel_clientes", {
      id: uuid(), nome_marca: nome, razao_social: `${nome} Comércio Ltda`, cnpj: `${pad(10 + i)}.${300 + i * 7}.${400 + i * 3}/0001-${pad(10 + i * 3)}`,
      nicho, instagram: `@${slug(nome)}`, tiktok: null, contato_nome: CONTATOS[i + 3], contato_email: `marketing@${slug(nome)}.com.br`,
      contato_telefone: `(11) 9${8000 + i * 37}-${1000 + i * 113}`, ja_trabalhou: trabalhou, status: i < 5 ? "ativo" : "inativo", etapa, created_at: momento(-90 + i * 6)
    }));
    (T.painel_abordagens || []).filter(a => a.status === "fechada").forEach((a, k) => {
      const c = clientes.find(x => x.nome_marca === a.marca) || clientes[k % clientes.length];
      a.cliente_id = c.id;
    });
    clientes.slice(0, 5).forEach((c, i) => add("painel_clientes_notas", { id: uuid(), cliente_id: c.id, data: dia(-entre(3, 40)), texto: escolher(["Fechamos 3 vídeos pro lançamento de verão.", "Pediu renovação do licenciamento por mais 60 dias.", "Abordei pra campanha de Dia das Mães, retorno positivo."]), created_at: momento(-10) }));

    // ------------------------------------------------------------------ Trabalhos UGC + Financeiro UGC
    const trabalhos = [
      ["Aurora Skin", "2 vídeos UGC + 30 dias de tráfego", 1450, "pago", -40, -10],
      ["Nuvem Colchões", "1 vídeo review + fotos", 980, "pago", -32, -6],
      ["Lume Cosméticos", "3 vídeos UGC", 1890, "entregue", -14, 3],
      ["Sol de Café", "Vídeo receita + unboxing", 760, "editar", -8, 6],
      ["Cacau da Serra", "2 vídeos para anúncio", 1180, "gravar", -6, 9],
      ["Vértice Tech", "Review do fone", 640, "roteiro", -4, 12],
      ["Fiora Joias", "Vídeo lifestyle", 850, "briefing_recebido", -2, 15],
      ["Ondina Cabelos", "Antes e depois", 700, "novo_lead", -1, 20]
    ];
    trabalhos.forEach(([marca, tipo, valor, etapa, fechamento, entrega], i) => {
      const cliente = clientes.find(c => c.nome_marca === marca);
      let negocioId = null;
      if (etapa === "pago" || etapa === "entregue"){
        const n = add("negocio_lancamentos", { id: uuid(), descricao: `${marca} — ${tipo}`, tipo: "ganho", data: dia(fechamento + 10), valor, recebido: etapa === "pago", data_prevista_recebimento: etapa === "pago" ? null : dia(5), created_at: momento(fechamento) });
        negocioId = n.id;
      }
      add("painel_ugc_trabalhos", {
        id: uuid(), marca, cliente_id: cliente ? cliente.id : null, origem: i % 3 ? "Outbound" : "Inbound", tipo_trabalho: tipo, valor,
        data_fechamento: dia(fechamento), data_pagamento_prevista: dia(entrega + 15), data_entrega: dia(entrega), etapa,
        briefing_url: i % 2 ? `https://drive.google.com/briefing-${slug(marca)}` : null, briefing_texto: null, briefing_arquivos: [],
        roteiro_texto: ["roteiro", "gravar", "editar", "entregue", "pago"].includes(etapa) ? "Gancho: \"Eu não acreditava que ia funcionar...\"\nCena 1: mostrando o produto na rotina.\nCTA: link na bio." : null,
        roteiro_aprovado: ["gravar", "editar", "entregue", "pago"].includes(etapa), edicao_aprovada: ["entregue", "pago"].includes(etapa),
        status_pagamento: etapa === "pago" ? "pago" : (etapa === "entregue" ? "a_pagar" : null), negocio_lancamento_id: negocioId,
        contrato_ativo: i < 3, trafego_pago_inicio: i < 3 ? dia(-20) : null, trafego_pago_fim: i < 3 ? dia(40) : null, quantidade_videos: 1 + (i % 3),
        nf_status: etapa === "pago" ? "emitida" : null, created_at: momento(fechamento)
      });
    });
    // Ganhos/gastos dos últimos 6 meses (variação natural)
    const diaNoMes = (mes, d) => { const x = new Date(HOJE.getFullYear(), HOJE.getMonth() + mes, Math.min(d, mes === 0 ? HOJE.getDate() : 28), 12); return iso(x); };
    for (let mes = -6; mes <= 0; mes++){
      const base = 3200 + mes * 180 + entre(-400, 600);
      [["Pacote 3 vídeos — " + escolher(MARCAS)[0], base * 0.45], ["Vídeo review — " + escolher(MARCAS)[0], base * 0.3], ["Licenciamento 30 dias — " + escolher(MARCAS)[0], base * 0.25]].forEach(([d, v], k) => {
        if (mes === 0 && k > 1) return; // mês atual ainda em andamento
        add("negocio_lancamentos", { id: uuid(), descricao: d, tipo: "ganho", data: diaNoMes(mes, 3 + k * 8), valor: Math.round(v), recebido: true, data_prevista_recebimento: null, created_at: momento(mes * 30) });
      });
      [["Ring light e tripé", 180], ["Edição terceirizada", 320], ["Assinatura app de edição", 59.9], ["Produtos pra cenário", 140]].forEach(([d, v], k) => {
        if ((mes + k) % 2 && mes !== 0) return;
        add("negocio_lancamentos", { id: uuid(), descricao: d, tipo: "investimento", data: diaNoMes(mes, 2 + k * 6), valor: v, recebido: true, created_at: momento(mes * 30) });
      });
    }

    // ------------------------------------------------------------------ Roteiros
    const cenas = [
      { tag_etapa: "gancho", tempo: "0-3s", descricao_cena: "Close no rosto, expressão de surpresa", narracao: "Gente, eu precisava contar isso pra vocês...", observacao: "" },
      { tag_etapa: "desenvolvimento", tempo: "3-15s", descricao_cena: "Mostrando o produto na bancada", narracao: "Faz duas semanas que eu uso e olha a diferença.", observacao: "Luz natural" },
      { tag_etapa: "cta", tempo: "15-20s", descricao_cena: "Produto na mão, olhando pra câmera", narracao: "O link tá aqui embaixo, corre que tá com desconto.", observacao: "" }
    ];
    [["Lume Cosméticos", "Protetor solar"], ["Sol de Café", "Café especial"], ["Cacau da Serra", "Chocolate 70%"]].forEach(([marca, produto], i) => {
      const rot = add("painel_roteiros", { id: uuid(), marca, produto, status: ["aprovado", "enviado", "rascunho"][i], categoria: "UGC", duracao_prevista: "20s", cenas, roteiro_html: null, link_token: uuid().slice(0, 12), created_at: momento(-6 + i * 2) });
      if (i < 2) add("painel_roteiros_respostas", { id: uuid(), roteiro_id: rot.id, marca, tipo: i === 0 ? "aprovado" : "ajuste", lida: i === 0, created_at: momento(-1 - i, 15) });
    });
    [["Como eu organizo minha semana de gravação", "Instagram"], ["3 erros que todo UGC iniciante comete", "TikTok"], ["Review honesto do meu setup", "YouTube"], ["Gancho que mais converteu esse mês", "Instagram"]].forEach(([titulo, fonte], i) => add("roteiros", {
      id: uuid(), fonte: fonte.toLowerCase(), url: `https://www.instagram.com/reel/DEMO${i}`, perfil: "@biavalenca.ugc", de_quem: "minha", titulo,
      transcricao: "Hoje eu vou te mostrar como eu organizo a minha semana de gravação. Primeiro eu separo os roteiros, depois eu monto o cenário de uma vez só e gravo tudo no mesmo dia...",
      legenda: "Salva pra lembrar depois 💛", status: "pronto", tags: ["rotina", "ugc"], capa_url: miniatura(titulo.split(" ").slice(0, 2).join(" "), "#000080", "#C9A66B", "🎬"),
      postado_em: dia(-5 - i * 4), created_at: momento(-5 - i * 4), updated_at: momento(-5 - i * 4)
    }));

    // ------------------------------------------------------------------ Mensagens (Portfólio, briefing)
    [["Renata Alves", "Toque Pele", "R$ 1.000 a R$ 2.000", "Oi Bia! Vimos seu portfólio e queremos 2 vídeos pro lançamento do hidratante. Pode mandar os valores?"],
     ["Marcos Lima", "Trilha Outdoor", "Até R$ 1.000", "Gostaria de um vídeo mostrando a mochila numa trilha. Vocês trabalham com permuta?"],
     ["Camila Duarte", "Nuance Make", "R$ 2.000 a R$ 5.000", "Somos uma marca de maquiagem e queremos fechar um pacote mensal de conteúdo."],
     ["Pedro Sales", "Garra Pet", "Até R$ 1.000", "Adoramos o vídeo com o cachorrinho! Queremos algo parecido."],
     ["Aline Freitas", "Bossa Bags", "R$ 1.000 a R$ 2.000", "Oi! Tem disponibilidade pra gravar ainda esse mês?"]].forEach(([name, brand, budget, message], i) => add("portfolio_leads", {
      id: uuid(), name, email: `${slug(name.split(" ")[0])}@${slug(brand)}.com.br`, phone: `(11) 9${7100 + i * 91}-${2200 + i * 77}`, brand, budget, message,
      source: "portfolio", lida: i > 1, created_at: momento(-i * 3, 11 + i, 20)
    }));
    [["Juliana Prado", "juliana@auroraskin.com.br"], ["Thiago Mendes", "(11) 99812-3344"], ["Larissa Gomes", "larissa@leveFitness.com.br"]].forEach(([nome, contato], i) => add("painel_briefing_respostas", {
      id: uuid(), nome, contato, lida: i > 0, created_at: momento(-i * 4 - 1, 14),
      respostas: { "Marca": escolher(MARCAS)[0], "Produto": escolher(MARCAS)[2], "Objetivo": "Vídeos pra anúncio e orgânico", "Quantidade de vídeos": String(1 + i), "Prazo": "15 dias", "Referências": "Vídeos curtos, tom leve e natural" }
    }));

    // ------------------------------------------------------------------ Dashboard e Portfólio (visitas)
    const ctasBiosite = ["contact_whatsapp", "contact_whatsapp_portfolio", "cta_cursos", "cta_cupons", "cta_achadinhos", "cta_icone_email", "cta_icone_tiktok", "cta_abrir_cursos", "cta_abrir_cupons", "cta_abrir_achadinhos"];
    const ctasPortfolio = ["contact_whatsapp", "contact_email", "contact_instagram", "cta_orcamento", "cta_ver_portfolio"];
    let contadorVisitante = 0;
    for (let d = -89; d <= 0; d++){
      const fimDeSemana = [0, 6].includes(new Date(Date.parse(dia(d))).getDay());
      const visitasBio = Math.max(4, Math.round(22 + 10 * Math.sin(d / 5) + entre(-6, 8) + (fimDeSemana ? 6 : 0) + (d > -14 ? 5 : 0)));
      for (let v = 0; v < visitasBio; v++){
        const vis = "v" + (contadorVisitante++ % 2400);
        const h = entre(8, 23), mi = entre(0, 59);
        add("portfolio_events", { id: uuid(), event_type: "page_view", event_name: null, session_id: vis, visitor_hash: vis, page_path: "/", metadata: null, created_at: momento(d, h, mi) });
        if (r() < 0.38) add("portfolio_events", { id: uuid(), event_type: "button_click", event_name: escolher(ctasBiosite), session_id: vis, visitor_hash: vis, page_path: "/", metadata: null, created_at: momento(d, h, Math.min(59, mi + 1)) });
      }
      const visitasPort = Math.max(1, Math.round(6 + 3 * Math.cos(d / 4) + entre(-2, 4)));
      for (let v = 0; v < visitasPort; v++){
        const vis = "p" + (contadorVisitante++ % 1800);
        const h = entre(9, 22), mi = entre(0, 59);
        add("portfolio_events", { id: uuid(), event_type: "page_view", event_name: null, session_id: vis, visitor_hash: vis, page_path: "/portfolio/", metadata: { origem: r() < 0.72 ? "direto" : "plataforma" }, created_at: momento(d, h, mi) });
        if (r() < 0.5) add("portfolio_events", { id: uuid(), event_type: "video_view", event_name: escolher(["Review sérum facial", "Unboxing café especial", "Rotina de skincare", "Look praia"]), session_id: vis, visitor_hash: vis, page_path: "/portfolio/", metadata: null, created_at: momento(d, h, Math.min(59, mi + 2)) });
        if (r() < 0.22) add("portfolio_events", { id: uuid(), event_type: "button_click", event_name: escolher(ctasPortfolio), session_id: vis, visitor_hash: vis, page_path: "/portfolio/", metadata: null, created_at: momento(d, h, Math.min(59, mi + 3)) });
      }
    }

    // ------------------------------------------------------------------ Agenda, checklist, mantras, ideias, projetos
    [["Gravar vídeos Cacau da Serra", "🎬", 0, false, "#000080"], ["Enviar roteiro Vértice Tech", "📝", 0, false, "#C9A66B"], ["Reunião com Nuance Make", "💬", 0, true, "#2D7A4F"], ["Editar vídeo Sol de Café", "✂️", 1, false, "#000080"], ["Postar reel da semana", "📱", 2, false, "#C9A66B"], ["Emitir nota Aurora Skin", "🧾", 3, false, "#6B645C"], ["Comprar fundo pro cenário", "🛍️", -1, true, "#6B645C"]].forEach(([titulo, emoji, d, concluida, cor]) => add("painel_tarefas", { id: uuid(), titulo, emoji, data: dia(d), concluida, cor, created_at: momento(d - 2) }));
    const rotina = ["Responder e-mails e DMs", "Prospectar 5 marcas novas", "Gravar conteúdo do dia", "Editar 1 vídeo", "Postar e interagir 20 min", "Atualizar o financeiro"];
    for (let ds = 0; ds < 7; ds++){
      (ds === 0 ? rotina.slice(0, 2) : rotina).forEach((texto, k) => add("painel_checklist_tarefas", { id: uuid(), dia_semana: ds, hora: `${pad(8 + k * 2)}:00`, texto, ordem: k, created_at: momento(-30) }));
    }
    T.painel_checklist_tarefas.filter(t => t.dia_semana === HOJE.getDay()).slice(0, 2).forEach(t => add("painel_checklist_progresso", { id: uuid(), data: dia(0), tarefa_id: t.id, feito: true, created_at: momento(0, 9) }));
    ["Fazer pouco e bem vale mais que fazer muito só pra dizer que fez.", "Constância vence talento.", "Cada não me aproxima do sim certo.", "Conteúdo bom é conteúdo que conecta."].forEach((conteudo, i) => add("painel_mantras", { id: uuid(), conteudo, cor: ["#000080", "#C9A66B", "#2D7A4F", "#6B645C"][i], fechada: false, created_at: momento(-20 + i) }));
    [["Trend do 'antes e depois' com o sérum", "#FCE9D8", "ugc"], ["Rotina da manhã em 15 segundos", "#E4ECFA", "organico"], ["Unboxing com ASMR", "#E8F3EA", "ugc"], ["Mostrar bastidores da gravação", "#F6E7F2", "organico"], ["Vídeo 'o que eu faria diferente'", "#FFF4CC", "ugc"], ["Série: 1 produto, 3 jeitos de usar", "#E4ECFA", "ugc"], ["Review sincero de 3 protetores", "#FCE9D8", "organico"], ["Tutorial rápido de cenário em casa", "#E8F3EA", null]].forEach(([conteudo, cor, categoria], i) => add("painel_notas", { id: uuid(), conteudo, cor, categoria, link: null, fechada: false, utilizada: i === 2, created_at: momento(-i * 3) }));
    [["Campanha de verão — Maré Moda Praia", "em_andamento", 12, 2400], ["Pacote mensal — Nuance Make", "proposta", 25, 3800], ["Lançamento — Lume Cosméticos", "em_andamento", 6, 1890], ["Black Friday — Casa Tília", "planejamento", 20, 1600]].forEach(([titulo, status, d, valor]) => add("painel_projetos", { id: uuid(), titulo, status, data_entrega: dia(d), valor, descricao: "Roteiros, gravação e edição.", created_at: momento(-10) }));

    // ------------------------------------------------------------------ IAra
    const sessoes = [["iara_abordagem", "Abordagem pra Toque Pele"], ["iara_estudo_produto", "Estudo do sérum Aurora Skin"], ["iara_roteiro_ugc", "Roteiro unboxing Sol de Café"], ["iara_roteiro_insta", "Reel: minha rotina de gravação"], ["iara_precificacao_ugc_comum", "Preço pacote 3 vídeos"]];
    sessoes.forEach(([contexto, titulo], i) => {
      const s = add("painel_iara_sessoes", { id: uuid(), contexto, titulo, status: i === 4 ? "finalizada" : "andamento", favorito: i === 1, created_at: momento(-i * 2), updated_at: momento(-i * 2, 16) });
      add("painel_ia_mensagens", { id: uuid(), sessao_id: s.id, contexto, papel: "user", conteudo: `Me ajuda com: ${titulo.toLowerCase()}?`, created_at: momento(-i * 2, 15) });
      add("painel_ia_mensagens", { id: uuid(), sessao_id: s.id, contexto, papel: "assistant", conteudo: "Claro! Pensei em 3 caminhos:\n\n1. **Gancho de curiosidade:** \"Eu não acreditava que isso funcionava...\"\n2. **Prova rápida:** mostrar o resultado nos primeiros 3 segundos.\n3. **CTA leve:** convidar pra conhecer no link da bio.\n\nQuer que eu desenvolva algum deles?", created_at: momento(-i * 2, 15, 1) });
    });
    [["UGC comum (1 vídeo)", 450], ["UGC criativo (1 vídeo)", 650], ["Publicidade (post + stories)", 900], ["Collab (vídeo no meu perfil)", 1200]].forEach(([tipo, valor_base]) => add("painel_iara_precificacao_tipos", { id: uuid(), tipo, valor_base, created_at: momento(-60) }));
    [[2, 3, 10], [4, 6, 15], [7, 99, 20]].forEach(([quantidade_min, quantidade_max, desconto_percentual]) => add("painel_iara_precificacao_desconto", { id: uuid(), quantidade_min, quantidade_max, desconto_percentual, created_at: momento(-60) }));

    // ------------------------------------------------------------------ Administrativo
    add("painel_documentos_pessoais", { id: uuid(), nome_completo: "Beatriz Valença Moura", nome_empresarial: "Bia Valença Produções de Conteúdo", cpf: "123.456.789-00", cnpj: "12.345.678/0001-90", created_at: momento(-120), updated_at: momento(-30) });
    [["Contrato padrão de licenciamento", "contrato-licenciamento.pdf"], ["Mídia kit 2026", "midia-kit.pdf"]].forEach(([nome, arquivo_nome]) => add("painel_documentos_avulsos", { id: uuid(), nome, arquivo_url: null, arquivo_nome, created_at: momento(-40) }));
    clientes.slice(0, 5).forEach((c, i) => add("painel_notas_fiscais", { id: uuid(), data_emissao: dia(-10 - i * 25), numero: String(120 + i), cliente_id: c.id, valor: [1450, 980, 1890, 760, 1180][i], arquivo_url: null, arquivo_nome: `nf-${120 + i}.pdf`, created_at: momento(-10 - i * 25) }));

    // ------------------------------------------------------------------ Financeiro pessoal (cartões, contas fixas, colaborador)
    const lancamentos = [
      ["Mercado do mês", "Nubank", "CASA", 486.3, 0], ["Farmácia", "Inter", "DI", 62.9, 0], ["Combustível", "Santander", "GU", 210, 0],
      ["Streaming", "Dígio", "DI/GU", 44.9, 0], ["Restaurante sábado", "Nubank", "DI/GU", 138, 0], ["Padaria", "Dinheiro/Outro", "CASA", 38.5, 0],
      ["Presente aniversário", "Mercado Pago", "MÃE", 129.9, 0], ["Pet shop", "Dígio", "DI/GU", 96.4, 0], ["Uber", "Inter", "DI", 27.8, 0],
      ["Material de escritório", "Santander", "EDMAR", 74.2, 0], ["Lanche", "Dígio", "FUUH", 32, 0], ["Academia", "Nubank", "DI", 99.9, 0]
    ];
    for (let mesDesloc = -2; mesDesloc <= 0; mesDesloc++){
      const base = primeiroDoMes(mesDesloc);
      lancamentos.forEach(([descricao, cartao, pessoa, valor], k) => {
        const variacao = Math.round(valor * (0.85 + r() * 0.3) * 100) / 100;
        const diaCompra = Math.min(27, 2 + k * 2);
        add("financas_lancamentos", { id: uuid(), data: base, data_compra: base.slice(0, 8) + pad(diaCompra), descricao: descricao.toUpperCase(), valor: variacao, cartao, pessoa, conferido: mesDesloc < 0, created_at: momento(mesDesloc * 30 + diaCompra) });
      });
    }
    // Compras parceladas (sequência certinha, 1 parcela por mês)
    [["Notebook", "Santander", "DI", 4199, 10, 4], ["Geladeira", "Nubank", "CASA", 3290, 12, 7], ["Celular", "Mercado Pago", "GU", 2399, 6, 2], ["Tênis corrida", "Dígio", "DI/GU", 599, 3, 1], ["Curso de edição", "Inter", "DI", 897, 6, 3]].forEach(([descricao, cartao, pessoa, total, parcelas, atual]) => {
      const grupo = uuid();
      const valorParcela = Math.round(total / parcelas * 100) / 100;
      for (let p = atual; p <= parcelas; p++){
        const desloc = p - atual - 1; // a parcela "atual" foi no mês passado
        if (desloc < -2) continue;
        add("financas_lancamentos", { id: uuid(), data: primeiroDoMes(desloc), data_compra: dia(-40), descricao: descricao.toUpperCase(), valor: valorParcela, cartao, pessoa, parcela_atual: p, parcela_total: parcelas, grupo_parcela: grupo, conferido: desloc < 0, created_at: momento(-40) });
      }
    });
    const fixas = { "Aluguel": [1850, "DI/GU"], "Água": [96, "DI/GU"], "Luz": [212, "DI/GU"], "TV": [89.9, "CASA"], "Fies": [310, "DI"], "Claro Celular": [69.9, "DI"], "Vivo Celular": [59.9, "GU"], "Vivo Internet": [119.9, "DI/GU"], "D4S CNPJ DI": [76.6, "DI"], "D4S CNPJ GU": [76.6, "GU"] };
    for (let mesDesloc = -3; mesDesloc <= 0; mesDesloc++){
      const { ano, mes } = anoMes(mesDesloc);
      Object.entries(fixas).forEach(([nome, [valor, pessoa]]) => {
        const v = ["Água", "Luz"].includes(nome) ? Math.round(valor * (0.88 + r() * 0.25) * 100) / 100 : valor;
        add("financas_gastos_fixos", { id: uuid(), nome, ano, mes, valor: v, pago: mesDesloc < 0 || ["Aluguel", "TV"].includes(nome), pessoa, created_at: momento(mesDesloc * 30) });
      });
      if (mesDesloc < 0){
        ["Dígio", "Inter", "Nubank", "Santander", "Mercado Pago"].forEach(cartao => add("financas_cartoes_pagos", { id: uuid(), cartao, ano, mes, pago: true, created_at: momento(mesDesloc * 30) }));
        ["DI", "GU", "EDMAR", "FUUH", "MÃE"].forEach(pessoa => add("financas_pessoas_pagas", { id: uuid(), pessoa, ano, mes, pago: true, created_at: momento(mesDesloc * 30) }));
        add("financas_meses_fechados", { ano, mes, fechado_em: momento(mesDesloc * 30 + 29), created_at: momento(mesDesloc * 30 + 29) });
        add("portal_gustavo_pensao", { ano, mes: mes + 1, vencimento: `${ano}-${pad(mes + 1)}-20`, valor: 950, pago: true, created_at: momento(mesDesloc * 30) });
        const pixAntigo = add("portal_gustavo_pix", { id: uuid(), data: dia(mesDesloc * 30 + 8), valor: 1240 + entre(-80, 120), ano_fatura: ano, mes_fatura: mes, created_at: momento(mesDesloc * 30 + 8) });
        // Pix de meses passados já confirmados (só o do mês atual fica pendente)
        add("painel_lembretes_snooze", { grupo: `pix-ok:${pixAntigo.id}`, adiado_ate: "2100-01-01T00:00:00.000Z", created_at: momento(mesDesloc * 30 + 9), updated_at: momento(mesDesloc * 30 + 9) });
      } else {
        add("portal_gustavo_pensao", { ano, mes: mes + 1, vencimento: `${ano}-${pad(mes + 1)}-20`, valor: 950, pago: false, created_at: momento(-2) });
        add("portal_gustavo_pix", { id: uuid(), data: dia(-1), valor: 600, ano_fatura: ano, mes_fatura: mes, created_at: momento(-1) });
      }
    }

    // ------------------------------------------------------------------ Links
    const categorias = ["Estudo", "Plataforma", "Ferramentas", "Financeiro"];
    categorias.forEach(nome => add("painel_links_categorias", { id: uuid(), nome, grupo: "links", created_at: momento(-50) }));
    ["Gancho", "Review", "Unboxing", "Tutorial / Como Usar"].forEach(nome => add("painel_links_categorias", { id: uuid(), nome, grupo: "referencias", created_at: momento(-50) }));
    [["Curso de roteiro UGC", "Estudo", "https://exemplo.com/curso-roteiro"], ["Plataforma de campanhas", "Plataforma", "https://exemplo.com/plataforma"], ["Banco de músicas livres", "Ferramentas", "https://exemplo.com/musicas"], ["Planilha de preços", "Financeiro", "https://exemplo.com/planilha"], ["Editor de vídeo online", "Ferramentas", "https://exemplo.com/editor"], ["Comunidade de creators", "Estudo", "https://exemplo.com/comunidade"]].forEach(([nome, categoria, url]) => add("painel_links", { id: uuid(), nome, categoria, url, descricao: null, grupo: "links", created_at: momento(-20) }));
    [["Gancho de curiosidade (skincare)", "Gancho"], ["Review com antes e depois", "Review"], ["Unboxing com ASMR", "Unboxing"]].forEach(([nome, categoria]) => add("painel_links", { id: uuid(), nome, categoria, url: "https://exemplo.com/referencia", descricao: null, grupo: "referencias", created_at: momento(-12) }));

    // ------------------------------------------------------------------ Instagram
    const automacoes = [["Mídia kit", "MIDIAKIT"], ["Cupom", "CUPOM"], ["Curso grátis", "AULA"]].map(([nome, keyword], i) => add("ig_automations", {
      id: uuid(), nome, keyword, match_any: false, active: i < 2, media_ids: [], public_reply: "Te mandei no direct! 💌", public_reply_variants: ["Te mandei no direct! 💌", "Olha seu direct 😉"],
      flow: { steps: [{ id: 1, message: `Oii! Aqui está o que você pediu (${nome.toLowerCase()}) 💛`, buttons: [{ title: "Abrir", url: "https://exemplo.com" }] }] }, asset_ids: [], created_at: momento(-30 + i), updated_at: momento(-3)
    }));
    USUARIOS_IG.forEach((u, i) => {
      const id = "ig" + (1000 + i);
      const auto = automacoes[i % 2];
      add("ig_leads", { ig_user_id: id, username: u, last_source: "comment", last_keyword: auto.keyword, automation_id: auto.id, flow_step: 1, link_sent: true, tags: [], email: null, telefone: null, created_at: momento(-entre(0, 28)), updated_at: momento(-entre(0, 5)) });
      for (let k = 0; k < 1 + (i % 3); k++){
        add("ig_comments", { id: uuid(), comment_id: "c" + i + k, ig_user_id: id, username: u, media_id: "m" + (i % 4), texto: auto.keyword, automation_id: auto.id, created_at: momento(-entre(0, 25)) });
        add("ig_deliveries", { id: uuid(), ig_user_id: id, automation_id: auto.id, canal: "dm", tipo: "flow", status: "ok", ts: momento(-entre(0, 25)) });
      }
    });
    add("ig_token_status", { id: "main", last_ok: true, expires_at: momento(50), last_refreshed_at: momento(-2), updated_at: momento(-2) });
    add("painel_ig_analises_ia", { id: uuid(), semana_inicio: dia(-HOJE.getDay()), ideias: [{ titulo: "Rotina de skincare em 15s", tipo: "Reel", nicho: "Beleza", origem: "Tendência", descricao: "Seus reels de rotina têm o dobro de salvamentos." }, { titulo: "Bastidores da gravação", tipo: "Carrossel", nicho: "UGC", origem: "Seus posts", descricao: "O público pede pra ver como você grava." }], oportunidades: [{ titulo: "Marcas de café estão contratando", descricao: "3 marcas do nicho postaram vagas de UGC esta semana." }], aviso: null, atualizado_em: momento(-1), created_at: momento(-1) });

    return trocarNomesPorExemplo(T);
  };

  // Respostas simuladas das funções na nuvem
  function serie(dias, base, varia){
    const r = criarSorteio(Number(iso(HOJE).replace(/-/g, "")) + dias);
    const lista = [];
    for (let i = dias - 1; i >= 0; i--) lista.push({ data: dia(-i), valor: Math.max(0, Math.round(base + varia * Math.sin(i / 3) + (r() - 0.5) * varia)) });
    return lista;
  }
  const POSTS = [
    ["Rotina de skincare em 15s", "#C9A66B", "#000080", "🧴"], ["3 ganchos que convertem", "#000080", "#6B645C", "🎯"],
    ["Bastidores da gravação", "#2D7A4F", "#C9A66B", "🎬"], ["Review sincero: protetor", "#6B645C", "#C9A66B", "☀️"],
    ["Meu setup de gravação", "#000080", "#2D7A4F", "📱"], ["Unboxing café especial", "#8a6d34", "#C9A66B", "☕"]
  ];
  window.EDI_DEMO_FUNCOES = {
    "ig-insights": (_corpo, nomeCompleto) => {
      const m = /dias=(\w+)/.exec(nomeCompleto || "");
      const dias = m ? (m[1] === "tudo" ? 90 : Number(m[1]) || 15) : 15;
      return { seguidores: 18640, novosSeguidoresPorDia: serie(dias, 38, 22), alcancePorDia: serie(dias, 2400, 1300), contasEngajadas: 3120, interacoes: 9840 };
    },
    "ig-media": () => ({ posts: POSTS.map(([legenda, c1, c2, e], i) => ({ id: "m" + i, legenda, miniatura: miniatura(legenda.split(" ").slice(0, 2).join(" "), c1, c2, e), curtidas: 900 + i * 213, comentarios: 40 + i * 17, salvos: 120 + i * 45, alcance: 8200 + i * 1530, visualizacoes: 14500 + i * 2100, timestamp: momento(-i * 3) })) }),
    "ig-analise-conteudo": () => ({ ideias: [{ titulo: "Antes e depois em 10s", tipo: "Reel", nicho: "Beleza", origem: "Tendência", descricao: "Formato com alto alcance no seu nicho." }, { titulo: "3 jeitos de usar o mesmo produto", tipo: "Carrossel", nicho: "UGC", origem: "Seus posts", descricao: "Seu público salva muito esse tipo de conteúdo." }], oportunidades: [{ titulo: "Marcas de skincare em alta", descricao: "Bom momento pra prospectar o nicho de beleza." }], relatorioPerfil: null, aviso: null }),
    "ia-assistente": () => ({ resposta: "Pensei em 3 caminhos pra você:\n\n1. **Gancho de curiosidade:** \"Eu não acreditava que isso funcionava...\"\n2. **Prova rápida:** mostrar o resultado logo nos primeiros segundos.\n3. **CTA leve:** convidar pra conhecer no link da bio.\n\nQuer que eu desenvolva algum deles em roteiro?" }),
    "ia-transcrever-audio": () => ({ texto: "Me ajuda a montar uma abordagem pra uma marca de café especial?" }),
    "enviar-emails": (corpo) => {
      const lista = (corpo && (corpo.destinatarios || corpo.emails || corpo.lista)) || [];
      const emails = lista.map(d => (typeof d === "string" ? d : d.email)).filter(Boolean);
      return { enviados: emails.length || 1, falhas: 0, pulados: 0, enviadosEmails: emails, cotaEsgotada: false };
    },
    "send-push": () => ({ ok: true }),
    "send-briefing-email": () => ({ ok: true }),
    "send-roteiro-email": () => ({ ok: true }),
    "instagram-oembed": () => ({ thumbnail_url: "" })
  };
  window.EDI_DEMO_RPC = {
    gustavo_nomes_fixos_atuais: (_args, { tabela }) => {
      const ultimo = {};
      tabela("financas_gastos_fixos").forEach(g => { const k = g.ano * 12 + g.mes; if (!ultimo[g.nome] || ultimo[g.nome].k < k) ultimo[g.nome] = { k, pessoa: g.pessoa }; });
      return Object.entries(ultimo).filter(([, v]) => v.pessoa === "GU" || v.pessoa === "DI/GU").map(([nome]) => ({ nome }));
    }
  };
})();
