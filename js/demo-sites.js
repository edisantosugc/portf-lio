/* =========================================================================
   js/demo-sites.js — Portfólio e Biosite de EXEMPLO (criadora fictícia)
   Só é usado na demonstração (edilainesantos.com/demo). Os próprios arquivos
   (portfolio/conteudo.js e index.html) chamam essas funções quando a demo está
   ativa; fora da demo, nada daqui roda.
   ========================================================================= */
(function(){
  "use strict";
  if (!window.EDI_DEMO) return;
  const P = window.EDI_DEMO.PERFIL;
  const X = (nome) => (window.EDI_DEMO.exemplo ? window.EDI_DEMO.exemplo(nome) : nome);
  const T = (texto) => (window.EDI_DEMO.trocarNomesTexto ? window.EDI_DEMO.trocarNomesTexto(texto) : texto);
  // Passa a troca de nomes em todo texto de um objeto (sem mexer nas imagens desenhadas)
  function trocarNomesEmTudo(obj){
    if (Array.isArray(obj)) { obj.forEach((v, i) => { if (typeof v === "string") obj[i] = T(v); else if (v && typeof v === "object") trocarNomesEmTudo(v); }); return; }
    if (!obj || typeof obj !== "object") return;
    Object.keys(obj).forEach(k => { const v = obj[k]; if (typeof v === "string") obj[k] = T(v); else if (v && typeof v === "object") trocarNomesEmTudo(v); });
  }

  const svgUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // Print de depoimento desenhado (sem foto/print real de ninguém)
  function printDepoimento(marca, texto, cor){
    const linhas = [];
    let atual = "";
    texto.split(" ").forEach(p => { if ((atual + " " + p).length > 34){ linhas.push(atual.trim()); atual = p; } else atual += " " + p; });
    if (atual.trim()) linhas.push(atual.trim());
    const alturaTexto = linhas.length * 34;
    const altura = 260 + alturaTexto;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${altura}" viewBox="0 0 600 ${altura}">
      <rect width="600" height="${altura}" rx="28" fill="#F3EEE9"/>
      <circle cx="70" cy="70" r="34" fill="${cor}"/><text x="70" y="82" font-family="Arial" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">E</text>
      <text x="122" y="64" font-family="Arial" font-size="26" font-weight="700" fill="#2A2622">${esc(X(marca))}</text>
      <text x="122" y="94" font-family="Arial" font-size="20" fill="#6B645C">agora mesmo</text>
      <rect x="40" y="130" width="520" height="${alturaTexto + 60}" rx="22" fill="#ffffff"/>
      ${linhas.map((l, i) => `<text x="68" y="${178 + i * 34}" font-family="Arial" font-size="24" fill="#2A2622">${esc(l)}</text>`).join("")}
      <text x="540" y="${215 + alturaTexto}" font-family="Arial" font-size="20" fill="#C9A66B" text-anchor="end">★★★★★</text>
    </svg>`;
    return svgUri(svg);
  }

  function icone(c1, c2, emoji){
    return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><text x="100" y="128" font-size="84" text-anchor="middle">${emoji}</text></svg>`);
  }

  const MARCAS_PORTFOLIO = ["Aurora Skin", "Nuvem Colchões", "Lume Cosméticos", "Sol de Café", "Fiora Joias", "Brisa Pet", "Casa Tília", "Vértice Tech", "Grão Vivo", "Maré Moda Praia", "Ondina Cabelos", "Cacau da Serra", "Leve Fitness", "Bambu Casa", "Zênite Óculos", "Garra Pet", "Nuance Make", "Pixel Fone"];
  const PORTFOLIO = [
    ["Leve Fitness", "Storytelling – Legging de compressão", "Saúde e Bem-estar"], ["Grão Vivo", "Review – Granola sem açúcar", "Saúde e Bem-estar"], ["Raiz Natural", "Rotina – Chá detox", "Saúde e Bem-estar"],
    ["Nuvem Colchões", "Depoimento – Colchão de molas", "Casa e Decoração"], ["Casa Tília", "Unboxing – Jogo de cama", "Casa e Decoração"], ["Bambu Casa", "Antes e depois – Organizadores", "Casa e Decoração"],
    ["Brisa Pet", "Storytelling – Petisco natural", "Pet"], ["Garra Pet", "Unboxing divertido – Brinquedos", "Pet"],
    ["Aurora Skin", "Problema x Solução – Sérum facial", "Beleza e Autocuidado"], ["Lume Cosméticos", "Educativo – Protetor solar", "Beleza e Autocuidado"], ["Ondina Cabelos", "Review – Máscara capilar", "Beleza e Autocuidado"],
    ["Fiora Joias", "Criativo – 1 brinco, 3 looks", "Moda e Acessórios"], ["Zênite Óculos", "Orgânico – Óculos de sol", "Moda e Acessórios"], ["Maré Moda Praia", "Lookbook – Coleção verão", "Moda e Acessórios"],
    ["Vértice Tech", "Comparação – Fone bluetooth", "Tech & Apps"], ["Pixel Fone", "Dicas – Carregador portátil", "Tech & Apps"],
    ["Sol de Café", "Storytelling – Café especial em casa", "Serviços e Experiências"], ["Cacau da Serra", "Criativo – Chocolate de Páscoa", "Datas Comemorativas"]
  ];
  const DEPOIMENTOS = [
    ["Aurora Skin", "O vídeo da Bia virou nosso melhor criativo do mês. Retenção altíssima e o CPA caiu pela metade!", "#000080"],
    ["Nuvem Colchões", "Entrega no prazo, roteiro impecável e um resultado que superou o esperado. Já fechamos o próximo!", "#C9A66B"],
    ["Lume Cosméticos", "A naturalidade dela no vídeo faz toda a diferença. Nossos clientes comentaram muito.", "#2D7A4F"],
    ["Sol de Café", "Profissional demais! Entendeu a essência da marca logo no briefing.", "#8a6d34"],
    ["Brisa Pet", "O vídeo com o cachorrinho bombou no orgânico. Muito obrigada, Bia!", "#6B645C"],
    ["Fiora Joias", "Conteúdo lindo e que vende. Recomendamos de olhos fechados.", "#000080"]
  ];

  window.EDI_DEMO.ajustarPortfolio = function(pt, en){
    [pt, en].forEach((C, i) => {
      if (!C) return;
      const ingles = i === 1;
      C.perfil = { ...C.perfil, nome: P.nome, nomeCurto: P.nomeCurto, instagramArroba: P.arroba, instagramUrl: "#", email: P.email, telefoneExibicao: "(11) 98765-4321", whatsappUrl: "#" };
      if (C.hero){
        C.hero.estatistica = ingles ? "+60 brands" : "+60 marcas trabalhadas";
        C.hero.baloMineira = ingles ? "From São Paulo" : "Paulistana";
        C.hero.baloPet = ingles ? "Coffee lover" : "Apaixonada por café";
        C.hero.baloSaudavel = ingles ? "Healthy routine" : "Rotina saudável";
      }
      C.marcas = MARCAS_PORTFOLIO.map(nome => ({ nome, logo: null }));
      if (C.sobre){
        C.sobre.titulo = (ingles ? "Hi, my name is " : "Oiee, me chamo ") + `<span class="nome-destaque">${P.nome}</span>`;
        C.sobre.paragrafos = ingles ? [
          "I am 28, from São Paulo, a coffee lover and UGC Creator.",
          "I turn products into stories people actually want to watch until the end.",
          "<strong>I have worked with more than 60 brands</strong>, creating <strong>hundreds of videos</strong> for organic and paid traffic.",
          "My job is to understand each brand and turn it into content that <strong>builds trust and sells</strong>."
        ] : [
          "Tenho 28 anos, sou paulistana, apaixonada por café e UGC Creator.",
          "Eu transformo produto em história que as pessoas querem assistir até o fim.",
          "<strong>Já trabalhei com mais de 60 marcas</strong>, produzindo <strong>centenas de vídeos</strong> pra orgânico e tráfego pago.",
          "Meu trabalho é entender a essência de cada marca e transformar isso em conteúdo que <strong>gera confiança e vende</strong>."
        ];
        if (Array.isArray(C.sobre.destaques)) C.sobre.destaques = [ingles ? "+60 BRANDS" : "+60 MARCAS TRABALHADAS"];
      }
      if (C.destaques){
        if (C.destaques.fixo){
          C.destaques.fixo.imagem = printDepoimento("Aurora Skin", ingles ? "Our best ad of the month! 12 sales in 2 days." : "Nosso melhor anúncio do mês! 12 vendas em 2 dias.", "#000080");
          C.destaques.fixo.legenda = ingles ? "12 sales in 2 days" : "12 vendas em 2 dias";
        }
        const legendas = ingles
          ? ["Problem x Solution – Facial serum", "Educational – Natural pet treat", "Testimonial – Mattress"]
          : ["Problema x Solução – Sérum facial", "Educativo – Petisco natural com o Bento", "Depoimento – Colchão"];
        (C.destaques.videos || []).forEach((v, k) => { v.videoId = ""; v.metricasImagem = null; if (legendas[k]) v.legenda = legendas[k]; });
        const etiquetas = ["Brisa Pet · Petisco natural · Orgânico", "Aurora Skin · Sérum facial · ADS", "Nuvem Colchões · Colchão de molas"];
        (C.destaques.cases || []).forEach((c, k) => {
          c.videoId = ""; c.linkPerfil = "";
          if (etiquetas[k]) c.etiqueta = etiquetas[k];
          if (c.print) c.print = { ...c.print, imagem: printDepoimento("Aurora Skin", ingles ? "Amazing retention, it sold really well!" : "Retenção absurda, vendeu muito bem!", "#C9A66B"), legenda: ingles ? "Aurora Skin feedback" : "Feedback da Aurora Skin", textoBotao: ingles ? "Tap to enlarge" : "Toque para ampliar o feedback" };
          if (c.texto) c.texto = c.texto.replace(/Condor|Natuka|Yool Sublimados|Yool/g, "a marca");
          // números de exemplo (não os reais)
          if (Array.isArray(c.metricas)) c.metricas = c.metricas.map((m, j) => ({ ...m, numero: ["98.400", "81.250", "3,1 mil", "2,2 mil", "276", "94", "88"][j] || m.numero }));
          if (Array.isArray(c.resultados) && c.resultados.length > 1) c.resultados = ingles ? ["3.1K shares", "98K views", "81K accounts reached"] : ["3,1 mil compartilhamentos", "98 mil visualizações", "81 mil contas alcançadas"];
        });
      }
      C.portfolio = PORTFOLIO.map(([marca, titulo, categoria], k) => ({ marca, titulo, categoria, gradiente: "grad-" + (1 + k % 6), videoId: "" }));
      if (Array.isArray(C.fotosUgc)) C.fotosUgc = C.fotosUgc.map(f => ({ ...f, imagem: "" }));
      if (Array.isArray(C.depoimentos)) C.depoimentos = DEPOIMENTOS.map(([marca, texto, cor]) => ({ imagem: printDepoimento(marca, texto, cor) }));
      if (Array.isArray(C.resultados)) C.resultados = [
        { numero: 42, sufixo: " mil+", rotulo: ingles ? "Followers" : "Seguidores nas redes sociais", decimais: 0 },
        { numero: 1.2, sufixo: ingles ? "M+" : " mi+", rotulo: ingles ? "Monthly views" : "Visualizações por mês", decimais: 1 },
        { numero: 60, sufixo: "+", rotulo: ingles ? "Brands" : "Marcas atendidas", decimais: 0 },
        { numero: 7.8, sufixo: "%", rotulo: ingles ? "Average engagement" : "Taxa média de engajamento", decimais: 1 }
      ];
      trocarNomesEmTudo(C);
    });
  };

  window.EDI_DEMO.ajustarBiosite = function(perfil, secoes){
    if (perfil){ perfil.nome = P.nome; perfil.email = P.email; perfil.tiktokUrl = "#"; perfil.instagramUrl = "#"; perfil.arroba = P.arroba; }
    if (!Array.isArray(secoes)) return;
    const novas = [
      { secao: (secoes[0] && secoes[0].secao) || "Trabalhe comigo", itens: [
        { titulo: "Quero te contratar como creator", link: "#", imagem: icone("#000080", "#C9A66B", "🎬"), dataContato: "contact_whatsapp" },
        { titulo: "Solicite meu portfólio 🦋", link: "#", imagem: icone("#C9A66B", "#000080", "📁"), dataContato: "contact_whatsapp_portfolio" }
      ]},
      { secao: "Cursos e Mentorias", recolhivel: true, dataCtaAbrir: "cta_abrir_cursos", itens: [
        { titulo: "Roteiro que Vende ✨", link: "#", imagem: icone("#2D7A4F", "#C9A66B", "📝"), dataCta: "cta_cursos" },
        { titulo: "Mentoria UGC do Zero", link: "#", imagem: icone("#000080", "#2D7A4F", "🎓"), dataCta: "cta_cursos" }
      ]},
      { secao: "Meus Cupons", recolhivel: true, dataCtaAbrir: "cta_abrir_cupons", itens: [
        { titulo: "Aurora Skin | 🏷️ BIA10", link: "#", imagem: icone("#C9A66B", "#8a6d34", "🧴"), dataCta: "cta_cupons" },
        { titulo: "Sol de Café | 🏷️ BIACAFE", link: "#", imagem: icone("#8a6d34", "#2A2622", "☕"), dataCta: "cta_cupons" }
      ]},
      { secao: "Achadinhos", recolhivel: true, dataCtaAbrir: "cta_abrir_achadinhos", itens: [
        { titulo: "Só os favoritos 💙", link: "#", imagem: icone("#000080", "#6B645C", "🛍️"), dataCta: "cta_achadinhos" },
        { titulo: "Setup de gravação", link: "#", imagem: icone("#6B645C", "#000080", "📱"), dataCta: "cta_achadinhos" }
      ]}
    ];
    trocarNomesEmTudo(novas);
    secoes.length = 0;
    novas.forEach(s => secoes.push(s));
  };
})();
