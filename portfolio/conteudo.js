/* =========================================================================
   PAINEL DE CONTEÚDO EDITÁVEL
   Todo o texto do site vem deste objeto. Para atualizar o site, edite os
   valores abaixo. Não é necessário mexer em nenhuma outra parte do código.
   ========================================================================= */
/* =========================================================================
   SITE EM 2 IDIOMAS (PT/EN)
   Existem dois painéis completos abaixo: CONFIG_PT e CONFIG_EN. Editando um
   texto, edite também o mesmo campo no outro objeto para as duas versões do
   site ficarem sempre sincronizadas. Campos que não são texto (videoId,
   gradiente, imagem, logo, número) são os mesmos nos dois.
   ========================================================================= */
const CONFIG_PT = {

  // EDITE AQUI: textos do menu e do botão de idioma
  nav: {
    inicio: "Início", sobre: "Sobre", portfolio: "Portfólio", servicos: "Serviços",
    feedbacks: "Feedbacks", cta: "Fale comigo"
  },

  // EDITE AQUI: dados pessoais e de contato
  perfil: {
    nome: "Edilaine Santos",
    nomeCurto: "Edilaine",
    profissao: "UGC Creator & Manager",
    instagramArroba: "@byedisantos",
    instagramUrl: "https://instagram.com/byedisantos",
    email: "edilainesantosugc@gmail.com",
    telefoneExibicao: "(19) 99384-2684",
    whatsappUrl: "https://wa.me/5519993842684"
  },

  // EDITE AQUI: textos principais da primeira dobra (Hero)
  hero: {
    tag: "UGC Creator & Manager",
    tituloParte1: "Histórias que ",
    tituloDestaque1: "conectam",
    tituloParte2: ". Estratégias que ",
    tituloDestaque2: "performam",
    tituloParte3: ".",
    frase: "Conteúdo que atrai, engaja e converte.",
    estatistica: "+100 marcas trabalhadas",
    textoCta: "Fale comigo",
    textoCtaSecundario: "Ver portfólio",
    baloMineira: "Mineirinha",
    baloPet: "Mãe de pet",
    baloSaudavel: "Rotina saudável"
  },

  faixaMarcas: { rotulo: "Marcas que já confiaram no meu trabalho" },

  // EDITE AQUI: marcas que já trabalharam com você (aparecem na faixa rolante).
  // "logo" é o nome do arquivo dentro de /portfolio/imagens/marcas/. Se "logo" for null,
  // aparece uma bolinha com as iniciais do nome no lugar.
  marcas: [
    { nome: "Alva", logo: "alva.jpg" },
    { nome: "Blis", logo: "blis.jpg" },
    { nome: "CleanNew Store", logo: "cleannew.jpg" },
    { nome: "Coala", logo: "coala.png" },
    { nome: "Condor", logo: "condor.jpg" },
    { nome: "Darrow", logo: "darrow.png" },
    { nome: "Dr. Lava Tudo", logo: "dr-lava-tudo.png" },
    { nome: "Dreams Nutrition", logo: "dreams-nutrition.jpg" },
    { nome: "FreePet", logo: "freepet.png" },
    { nome: "Garnie", logo: "garnie.jpg" },
    { nome: "Itambé", logo: "itambe.jpg" },
    { nome: "Max Titanium", logo: "max-titanium.jpg" },
    { nome: "Mega Ótica Opção", logo: "mega-otica-opcao.jpg" },
    { nome: "Natuka", logo: "natuka.png" },
    { nome: "Nivea", logo: "nivea.png" },
    { nome: "Pantene", logo: "pantene.png" },
    { nome: "Pibe", logo: "pibe.jpg" },
    { nome: "Rainha Nativa", logo: "rainha-nativa.jpg" },
    { nome: "Rituária", logo: "rituaria.jpg" },
    { nome: "Saint Germain", logo: "saint-germain.jpg" },
    { nome: "Seu Influencer", logo: "seu-influencer.jpg" },
    { nome: "Shopee", logo: "shopee.png" },
    { nome: "Show de Pizzaiolo", logo: "show-de-pizzaiolo.png" },
    { nome: "Vhita", logo: "vhita.png" },
    { nome: "Voga", logo: "voga.jpg" },
    { nome: "Yool", logo: "yool.jpg" },
    { nome: "Marca R", logo: "logo-r.png" }
  ],

  // EDITE AQUI: texto e destaques da seção Sobre
  sobre: {
    tag: "Sobre mim",
    titulo: "Oiee, me chamo <span class=\"nome-destaque\">Edilaine Santos<span class=\"decor-borboleta\" aria-hidden=\"true\"><img src=\"/portfolio/imagens/borboleta.png\" alt=\"\"></span></span>",
    paragrafos: [
      "Tenho 30 anos, sou mineira, mãe de pet e UGC Creator.",
      "Escrever sempre fez parte de mim. Desde pequena eu já transformava sentimento em palavra, criava história, achava sentido até nas coisas mais simples do dia a dia. Com o tempo, isso virou meu maior diferencial no UGC: pegar uma marca e transformar ela em conteúdo que gera identificação, confiança e aproxima.",
      "<strong>Já trabalhei com mais de 100 marcas</strong>, produzindo <strong>centenas de conteúdos</strong>, transitando por vários estilos e formatos. Mas storytelling é o que faz a marca ser lembrada depois do vídeo, porque anúncio informa e história conecta.",
      "Meu trabalho vai além de criar conteúdo: é entender a essência de cada marca e transformar isso em narrativa que <strong>fortalece a relação com o público e traz resultado</strong>.",
      "Porque o que fica é sentimento. <strong>E sentimento vira confiança. E confiança vira resultado.</strong>"
    ],
    destaques: [
      "+100 MARCAS TRABALHADAS",
      "<svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"currentColor\" style=\"vertical-align:-3px;margin-right:2px\" aria-hidden=\"true\"><path d=\"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z\"/></svg> HORTOLÂNDIA – SP"
    ]
  },

  destaquesTextos: {
    tag: "Em destaque",
    titulo: "Conteúdos em Destaque",
    subtitulo: "Alguns dos conteúdos que mais geraram conexão e conversão."
  },

  // EDITE AQUI: conteúdos do carrossel "Conteúdos em Destaque".
  // "fixo" é o card da coluna ESQUERDA — sempre o mesmo, nunca muda (hoje é
  // o print de feedback). "videos" é a lista de vídeos que aparece na coluna
  // DIREITA; só um vídeo aparece por vez, e as setas/pontinhos alternam entre
  // eles (o 1º da lista é o que aparece primeiro). Pra adicionar um vídeo
  // novo, copie um bloco { ... } de dentro de "videos" e troque os campos.
  destaques: {
    fixo: {
      tipo: "imagem",
      imagem: "/portfolio/imagens/destaque-feedback-1.jpg",
      estatistica: "Atualizadíssima ao que funciona em tráfego pago",
      legenda: "12 vendas em curto prazo",
      legendaDestacada: true
    },
    videos: [
      {
        tipo: "video",
        videoId: "6GuW7LC-6yE",
        legenda: "Problema x Solução – Criativo Gêmeas"
      },
      {
        tipo: "video",
        videoId: "C5vleYWynVM",
        legenda: "Educativo – Palitinhos de enriquecimento ambiental, com o Théo",
        metricasImagem: "/portfolio/imagens/destaque-theo-metricas.png"
      },
      {
        tipo: "video",
        videoId: "sldWgcR84co",
        legenda: "Depoimento – Esponja limpeza extrema"
      }
    ]
  },

  portfolioTextos: {
    tag: "Portfólio",
    titulo: "Trabalhos que já viraram resultado para as marcas",
    subtitulo: "Assista aos vídeos reais que eu já produzi, organizados por nicho."
  },

  // EDITE AQUI: ordem dos nichos de portfólio (cada um vira uma fileira, estilo Netflix)
  categoriasPortfolio: [
    "Fitness", "Casa e Decoração", "Pet", "Beleza e Autocuidado",
    "Moda e Acessórios", "Tech & Apps", "Serviços e Experiências", "Datas Comemorativas"
  ],

  // EDITE AQUI: trabalhos do portfólio, com vídeos reais hospedados no YouTube (modo não listado).
  // O campo "videoId" é o código que vem depois de "youtube.com/shorts/" no link do vídeo.
  // Exemplo: no link "https://youtube.com/shorts/Zd0B7ttQZJQ" o videoId é "Zd0B7ttQZJQ".
  // "marca" não aparece no site (é só para os relatórios do painel); a legenda mostrada no
  // card é sempre "titulo". Para adicionar um vídeo, copie um bloco { ... } e troque os campos.
  portfolio: [
    // Fitness (ordem e itens sincronizados com o doc VÍDEOS.docx)
    { marca: "Via Fight", titulo: "Storytelling – Jaquetinha fitness", categoria: "Fitness", gradiente: "grad-1", videoId: "7oAktYjTXx4" },
    { marca: "Max Titanium", titulo: "Narrador – Barrinha de proteína", categoria: "Fitness", gradiente: "grad-2", videoId: "Zd0B7ttQZJQ" },
    { marca: "Via Fight", titulo: "Rotina – Conjunto fitness", categoria: "Fitness", gradiente: "grad-3", videoId: "hzA0a3U7ass" },
    { marca: "Dreams Burn", titulo: "Storytelling – Cubo termogênico", categoria: "Fitness", gradiente: "grad-4", videoId: "3pbXGVEFaog" },
    { marca: "Shopee", titulo: "Orgânico – Conjuntinho fitness", categoria: "Fitness", gradiente: "grad-5", videoId: "Y4YrncO4UZo" },
    { marca: "Max Titanium", titulo: "Depoimento – Whey drink", categoria: "Fitness", gradiente: "grad-6", videoId: "KbJBIB5RHCI" },
    // Rap 10 (Jme4EkWP1oY) retirado: não consta no VÍDEOS.docx

    // Casa e Decoração
    { marca: "Condor", titulo: "Storytelling – Mop PVA e rolo de tirar pelo", categoria: "Casa e Decoração", gradiente: "grad-5", videoId: "rjblZsgruDA" },
    { marca: "Eletrolux", titulo: "Educativo – Refil filtro purificador de água", categoria: "Casa e Decoração", gradiente: "grad-6", videoId: "e6SAuK22QwM" },
    { marca: "Shopee", titulo: "Marketplace – Capa de colchão impermeável", categoria: "Casa e Decoração", gradiente: "grad-1", videoId: "AbXbrKyfHcQ" },
    { marca: "Shein", titulo: "Marketplace – Jogo de cama", categoria: "Casa e Decoração", gradiente: "grad-2", videoId: "vSGOS-KIKUE" },
    { marca: "Coala", titulo: "Depoimento – Kit cheirinho orquídea negra", categoria: "Casa e Decoração", gradiente: "grad-3", videoId: "ogsVF7O7wMM" },
    // Dobuê (AmDppLUwvuc) retirado: não consta no VÍDEOS.docx

    // Pet (o vídeo da Natuka/Théo saiu daqui porque agora ele tem destaque
    // próprio na seção "Conteúdos em Destaque" — é o mesmo vídeo, só que
    // promovido, como no doc VÍDEOS.docx, que o separa em "DESTAQUES (1 VÍDEO)")
    { marca: "FreePet", titulo: "Storytelling – Limpa canil + neutralizador de odores", categoria: "Pet", gradiente: "grad-1", videoId: "d1fmuHk5sEU" },
    { marca: "Petiko", titulo: "Unboxing divertido – Petiscos e brinquedos", categoria: "Pet", gradiente: "grad-2", videoId: "c6-PNqQZslE" },
    { marca: "Nutrafases", titulo: "Depoimento – Suplemento alimentar probiótico", categoria: "Pet", gradiente: "grad-3", videoId: "t9FO_B2oydI" },
    { marca: "New Pet", titulo: "Storytelling – Bebedouro de água inteligente", categoria: "Pet", gradiente: "grad-4", videoId: "pkf21wmwvvs" },

    // Beleza e Autocuidado
    { marca: "Condor", titulo: "Storytelling – Pincéis de maquiagem", categoria: "Beleza e Autocuidado", gradiente: "grad-5", videoId: "usONnfgOlzU" },
    { marca: "Alva", titulo: "Narrador/Educativo – Raspador de língua", categoria: "Beleza e Autocuidado", gradiente: "grad-6", videoId: "k17j7zWKmuA" },
    { marca: "Mayara", titulo: "Experiência – Design de sobrancelha", categoria: "Beleza e Autocuidado", gradiente: "grad-1", videoId: "8K0wrl9mf0U" },
    { marca: "Condor", titulo: "Educativo – Escova de dente antibac", categoria: "Beleza e Autocuidado", gradiente: "grad-2", videoId: "M7HjEF0YcqU" },
    { marca: "Condor", titulo: "Dica – Kit escova de cabelo com canetinhas para colorir", categoria: "Beleza e Autocuidado", gradiente: "grad-3", videoId: "rqMTFESTsAw" },
    { marca: "Alva", titulo: "Review – Desodorante cristal", categoria: "Beleza e Autocuidado", gradiente: "grad-4", videoId: "vOmNzVuLXJw" },
    // Dermacyd (KMh3cYekKEM) e Pantene (38m6Q-Pr5S0) retirados (confirmado em "VÍDEOS ANTIGOS - RETIRADOS.docx")

    // Moda e Acessórios
    { marca: "Vans", titulo: "Criativo – 1 tênis, vários looks", categoria: "Moda e Acessórios", gradiente: "grad-2", videoId: "80XKBvwlWfU" },
    { marca: "Ótica Mega Opção", titulo: "Orgânico – Óculos de grau", categoria: "Moda e Acessórios", gradiente: "grad-3", videoId: "_qhaRoUB1b0" },
    { marca: "Shein", titulo: "Achadinho – Pijamas", categoria: "Moda e Acessórios", gradiente: "grad-4", videoId: "Ycp2cp5_ps0" },
    { marca: "Saint Germain", titulo: "Apresentação – Relógio", categoria: "Moda e Acessórios", gradiente: "grad-5", videoId: "di5b_sg4_M8" },

    // Tech & Apps
    { marca: "Hollyland", titulo: "Comparação – Microfone", categoria: "Tech & Apps", gradiente: "grad-6", videoId: "KXBxVTr8PXA" },
    { marca: "Konta IA", titulo: "Storytelling – Aplicativo organização financeira", categoria: "Tech & Apps", gradiente: "grad-1", videoId: "v2zf26ctp98" },
    { marca: "Samsung", titulo: "Unboxing ASMR – Tablet", categoria: "Tech & Apps", gradiente: "grad-2", videoId: "H7vk2JF62PM" },
    { marca: "Hollyland", titulo: "Dicas – Microfone", categoria: "Tech & Apps", gradiente: "grad-3", videoId: "uCHl56vK6Zc" },
    // QCY (Mb6rUOi0qAs) retirado (confirmado em "VÍDEOS ANTIGOS - RETIRADOS.docx")

    // Serviços e Experiências
    { marca: "Dr. Lava Tudo", titulo: "Storytelling – Limpeza automotiva", categoria: "Serviços e Experiências", gradiente: "grad-5", videoId: "V2rAhr3_D7E" },
    { marca: "Show de Pizzaiolo", titulo: "Storytelling – Rodízio de pizza em domicílio", categoria: "Serviços e Experiências", gradiente: "grad-6", videoId: "o9KozkhVU-E" },
    { marca: "Dr. Lava Tudo", titulo: "Storytelling – Limpeza de sofá + colchão", categoria: "Serviços e Experiências", gradiente: "grad-1", videoId: "Y3b5WeKfBP0" },
    { marca: "Show de Pizzaiolo", titulo: "Tráfego pago – Rodízio de pizza em domicílio (foco em alcançar franqueados)", categoria: "Serviços e Experiências", gradiente: "grad-2", videoId: "7n_Mol2CiSM" },

    // Datas Comemorativas (Clínica Panzerri primeiro, ordem ajustada no VÍDEOS.docx)
    { marca: "Clínica Panzerri", titulo: "Storytelling – Dia das Mães", categoria: "Datas Comemorativas", gradiente: "grad-3", videoId: "0I-u5Lg0l1k" },
    { marca: "Yool", titulo: "Podcast junino (criativo gêmeas) – Respondendo perguntas, saia godê", categoria: "Datas Comemorativas", gradiente: "grad-4", videoId: "bzI86bSqRDQ" },
    { marca: "Yool", titulo: "Site na parede (criativo) – Diversos produtos junino", categoria: "Datas Comemorativas", gradiente: "grad-5", videoId: "pvBmrnzCdHA" }
  ],

  fotosUgcTextos: {
    tag: "Fotos UGC",
    tituloHtml: "também faço <span class=\"destaque-italico\">fotos</span>."
  },

  // EDITE AQUI: fotos UGC (grade 6x2). Coloque o arquivo dentro de "imagens" e
  // preencha "imagem"; se o arquivo não existir, o gradiente aparece no lugar.
  // "posicao" é opcional: ajusta o enquadramento do corte (padrão "center").
  // Use algo como "center 0%" pra puxar o corte mais pra cima da foto.
  // "filtro" é opcional: ajusta brilho/contraste (ex: "brightness(.88) contrast(1.08) saturate(1.05)").
  fotosUgc: [
    { imagem: "/portfolio/imagens/foto-ugc-1.jpg", gradiente: "grad-1" },
    { imagem: "/portfolio/imagens/foto-ugc-2.jpg", gradiente: "grad-2" },
    { imagem: "/portfolio/imagens/foto-ugc-3.jpg", gradiente: "grad-3" },
    { imagem: "/portfolio/imagens/foto-ugc-4.jpg", gradiente: "grad-4" },
    { imagem: "/portfolio/imagens/foto-ugc-5.jpg", gradiente: "grad-5" },
    { imagem: "/portfolio/imagens/foto-ugc-6.jpg", gradiente: "grad-6" },
    { imagem: "/portfolio/imagens/foto-ugc-7.jpg", gradiente: "grad-1" },
    { imagem: "/portfolio/imagens/foto-ugc-8.jpg", gradiente: "grad-2" },
    { imagem: "/portfolio/imagens/foto-ugc-9.jpg", gradiente: "grad-3" },
    { imagem: "/portfolio/imagens/foto-ugc-10.jpg", gradiente: "grad-4" },
    { imagem: "/portfolio/imagens/foto-ugc-11.jpg", gradiente: "grad-5" },
    { imagem: "/portfolio/imagens/foto-ugc-12.jpg", gradiente: "grad-6" }
  ],

  servicosTextos: {
    tag: "Serviços",
    titulo: "O que eu posso criar para a sua marca",
    subtitulo: "Conteúdo pensado para gerar confiança, engajamento e, principalmente, vendas."
  },

  // EDITE AQUI: cards de serviços oferecidos (o campo "icone" aceita um emoji)
  servicos: [
    { icone: "🎬", titulo: "Vídeo UGC", descricao: "Criação de conteúdo estratégico com foco em vendas para você utilizar em seu próprio perfil e anúncios.", cta: "Quero UGC que converte" },
    { icone: "🗂️", titulo: "UGC Manager", descricao: "Ao invés de criar, farei a gestão completa de campanhas com outras UGC's para que você fique livre, cuidarei desde a contratação até a entrega dos conteúdos.", cta: "Quero gestão de UGC's" },
    { icone: "📱", titulo: "Reels e TikToks", descricao: "Conteúdo dinâmico, editado no ritmo das redes sociais e pronto para publicar ou usar em anúncios.", cta: "Quero conteúdo pra redes" },
    { icone: "📸", titulo: "Fotos de Produto", descricao: "Imagens autênticas e bem iluminadas que mostram o seu produto no dia a dia real.", cta: "Quero fotos de produto" },
    { icone: "📦", titulo: "Unboxing", descricao: "Vídeos de abertura de caixa com reação genuína, despertando desejo de compra em quem assiste.", cta: "Quero um unboxing" },
    { icone: "⭐", titulo: "Depoimentos e Reviews", descricao: "Avaliações sinceras e persuasivas que aumentam a confiança do público na sua marca.", cta: "Quero depoimentos reais" },
    { icone: "🚀", titulo: "Conteúdo para Anúncios", descricao: "Vídeos pensados para performar como anúncio pago, com gancho forte nos primeiros segundos.", cta: "Quero criar anúncios" },
    { icone: "🤝", titulo: "UGC + Collab", descricao: "Divulgação para a minha própria comunidade, feito em colaboração. No meu perfil abordo autocuidado e lifestyle.", cta: "Quero fazer uma collab" }
  ],

  resultadosTextos: {
    tag: "Resultados",
    titulo: "Números que mostram o meu impacto",
    subtitulo: "Dados reais de alcance e entrega que ajudam marcas a decidir com confiança."
  },

  // EDITE AQUI: números de destaque (a contagem anima sozinha ao aparecer na tela)
  // "decimais" define quantas casas decimais aparecem no número
  resultados: [
    { numero: 85, sufixo: " mil+", rotulo: "Seguidores nas redes sociais", decimais: 0 },
    { numero: 1.5, sufixo: " mi+", rotulo: "Visualizações por mês", decimais: 1 },
    { numero: 40, sufixo: "+", rotulo: "Marcas atendidas", decimais: 0 },
    { numero: 8.5, sufixo: "%", rotulo: "Taxa média de engajamento", decimais: 1 }
  ],

  depoimentosTextos: {
    tag: "Depoimentos",
    titulo: "O que as marcas dizem sobre o meu trabalho",
    subtitulo: "Depoimentos de marcas que sentiram na prática o poder de um conteúdo estratégico."
  },

  // EDITE AQUI: depoimentos de clientes (prints reais de feedback).
  // Cada depoimento é só a imagem do print; para adicionar mais, copie a linha e troque o nome do arquivo.
  // OBS: os prints são reais e ficam em português nas duas versões do site (não são traduzidos).
  depoimentos: [
    // depoimento-1.jpg removido: esse print já aparece na seção "Conteúdos em Destaque".
    { imagem: "/portfolio/imagens/depoimento-2.jpg" },
    { imagem: "/portfolio/imagens/depoimento-3.jpg" },
    { imagem: "/portfolio/imagens/depoimento-4.jpg" },
    { imagem: "/portfolio/imagens/depoimento-5.jpg" },
    { imagem: "/portfolio/imagens/depoimento-6.jpg" },
    { imagem: "/portfolio/imagens/depoimento-7.jpg" },
    { imagem: "/portfolio/imagens/depoimento-8.jpg" },
    { imagem: "/portfolio/imagens/depoimento-9.jpg" },
    { imagem: "/portfolio/imagens/depoimento-10.jpg" }
  ],

  contatoTextos: {
    tag: "Contato",
    titulo: "Vamos criar o próximo conteúdo de sucesso da sua marca?",
    subtitulo: "Me chame agora mesmo e receba uma proposta personalizada para o seu produto.",
    labelNome: "Nome",
    labelEmail: "E-mail",
    labelMarca: "Marca / Empresa",
    labelOrcamento: "Orçamento estimado",
    labelMensagem: "Conta sobre o projeto",
    placeholderNome: "Seu nome",
    placeholderEmail: "voce@marca.com",
    placeholderMarca: "Nome da marca",
    placeholderOrcamento: "Ex: R$ 1.000 a R$ 5.000",
    placeholderMensagem: "Categoria, formato, prazo, objetivo da campanha...",
    botaoEnviar: "Enviar mensagem",
    botaoEnviando: "Enviando...",
    mensagemSucesso: "Obrigada pelo contato! Recebi sua mensagem e vou te responder em breve.",
    mensagemErro: "Não consegui enviar sua mensagem agora. Tente novamente ou me chame direto no WhatsApp."
  },

  // EDITE AQUI: texto do rodapé
  rodape: {
    copyrightTexto: "Todos os direitos reservados."
  }
};

// EDIT HERE: English version. Keep this in sync with CONFIG_PT above whenever you update content.
const CONFIG_EN = {

  nav: {
    inicio: "Home", sobre: "About", portfolio: "Portfolio", servicos: "Services",
    feedbacks: "Feedback", cta: "Get in touch"
  },

  perfil: {
    nome: "Edilaine Santos",
    nomeCurto: "Edilaine",
    profissao: "UGC Creator & Manager",
    instagramArroba: "@byedisantos",
    instagramUrl: "https://instagram.com/byedisantos",
    email: "edilainesantosugc@gmail.com",
    telefoneExibicao: "(19) 99384-2684",
    whatsappUrl: "https://wa.me/5519993842684"
  },

  hero: {
    tag: "UGC Creator & Manager",
    tituloParte1: "Stories that ",
    tituloDestaque1: "connect",
    tituloParte2: ". Strategies that ",
    tituloDestaque2: "perform",
    tituloParte3: ".",
    frase: "Content that attracts, engages, and converts.",
    estatistica: "+100 brands worked with",
    textoCta: "Get in touch",
    textoCtaSecundario: "View portfolio",
    baloMineira: "From Minas Gerais",
    baloPet: "Pet mom",
    baloSaudavel: "Healthy routine"
  },

  faixaMarcas: { rotulo: "Brands that have trusted my work" },

  marcas: [
    { nome: "Alva", logo: "alva.jpg" },
    { nome: "Blis", logo: "blis.jpg" },
    { nome: "CleanNew Store", logo: "cleannew.jpg" },
    { nome: "Coala", logo: "coala.png" },
    { nome: "Condor", logo: "condor.jpg" },
    { nome: "Darrow", logo: "darrow.png" },
    { nome: "Dr. Lava Tudo", logo: "dr-lava-tudo.png" },
    { nome: "Dreams Nutrition", logo: "dreams-nutrition.jpg" },
    { nome: "FreePet", logo: "freepet.png" },
    { nome: "Garnie", logo: "garnie.jpg" },
    { nome: "Itambé", logo: "itambe.jpg" },
    { nome: "Max Titanium", logo: "max-titanium.jpg" },
    { nome: "Mega Ótica Opção", logo: "mega-otica-opcao.jpg" },
    { nome: "Natuka", logo: "natuka.png" },
    { nome: "Nivea", logo: "nivea.png" },
    { nome: "Pantene", logo: "pantene.png" },
    { nome: "Pibe", logo: "pibe.jpg" },
    { nome: "Rainha Nativa", logo: "rainha-nativa.jpg" },
    { nome: "Rituária", logo: "rituaria.jpg" },
    { nome: "Saint Germain", logo: "saint-germain.jpg" },
    { nome: "Seu Influencer", logo: "seu-influencer.jpg" },
    { nome: "Shopee", logo: "shopee.png" },
    { nome: "Show de Pizzaiolo", logo: "show-de-pizzaiolo.png" },
    { nome: "Vhita", logo: "vhita.png" },
    { nome: "Voga", logo: "voga.jpg" },
    { nome: "Yool", logo: "yool.jpg" },
    { nome: "Marca R", logo: "logo-r.png" }
  ],

  sobre: {
    tag: "About me",
    titulo: "Hi, I'm <span class=\"nome-destaque\">Edilaine Santos<span class=\"decor-borboleta\" aria-hidden=\"true\"><img src=\"/portfolio/imagens/borboleta.png\" alt=\"\"></span></span>",
    paragrafos: [
      "I'm 30 years old, from Minas Gerais, a pet mom, and a UGC Creator.",
      "Writing has always been part of who I am. Since I was little, I turned feelings into words, created stories, found meaning even in the simplest everyday things. Over time, that became my biggest edge in UGC: taking a brand and turning it into content that builds identification, trust, and connection.",
      "<strong>I've worked with over 100 brands</strong>, producing <strong>hundreds of pieces of content</strong>, moving across many styles and formats. But storytelling is what makes a brand memorable after the video ends, because ads inform and stories connect.",
      "My work goes beyond creating content: it's about understanding the essence of each brand and turning that into a narrative that <strong>strengthens the relationship with the audience and drives results</strong>.",
      "Because what stays is feeling. <strong>And feeling becomes trust. And trust becomes results.</strong>"
    ],
    destaques: [
      "+100 BRANDS WORKED WITH",
      "<svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"currentColor\" style=\"vertical-align:-3px;margin-right:2px\" aria-hidden=\"true\"><path d=\"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z\"/></svg> HORTOLÂNDIA, BRAZIL"
    ]
  },

  destaquesTextos: {
    tag: "Highlights",
    titulo: "Featured Content",
    subtitulo: "Some of the content that generated the most buzz and results."
  },

  destaques: {
    fixo: {
      tipo: "imagem",
      imagem: "/portfolio/imagens/destaque-feedback-1.jpg",
      estatistica: "Always up to date with what works in paid traffic",
      legenda: "12 sales in a short time",
      legendaDestacada: true
    },
    videos: [
      {
        tipo: "video",
        videoId: "6GuW7LC-6yE",
        legenda: "Problem x Solution – Twins Creative"
      },
      {
        tipo: "video",
        videoId: "C5vleYWynVM",
        legenda: "Educational – Enrichment chew sticks, featuring Théo",
        metricasImagem: "/portfolio/imagens/destaque-theo-metricas.png"
      },
      {
        tipo: "video",
        videoId: "sldWgcR84co",
        legenda: "Testimonial – Extreme-clean sponge"
      }
    ]
  },

  portfolioTextos: {
    tag: "Portfolio",
    titulo: "Work that has already delivered results for brands",
    subtitulo: "Watch real videos I've produced, organized by niche."
  },

  categoriasPortfolio: [
    "Fitness", "Home & Decor", "Pet", "Beauty & Self-Care",
    "Fashion & Accessories", "Tech & Apps", "Services & Experiences", "Special Occasions"
  ],

  portfolio: [
    // Fitness
    { marca: "Via Fight", titulo: "Storytelling – Fitness jacket", categoria: "Fitness", gradiente: "grad-1", videoId: "7oAktYjTXx4" },
    { marca: "Max Titanium", titulo: "Voiceover – Protein bar", categoria: "Fitness", gradiente: "grad-2", videoId: "Zd0B7ttQZJQ" },
    { marca: "Via Fight", titulo: "Routine – Fitness set", categoria: "Fitness", gradiente: "grad-3", videoId: "hzA0a3U7ass" },
    { marca: "Dreams Burn", titulo: "Storytelling – Thermogenic cube", categoria: "Fitness", gradiente: "grad-4", videoId: "3pbXGVEFaog" },
    { marca: "Shopee", titulo: "Organic – Fitness set", categoria: "Fitness", gradiente: "grad-5", videoId: "Y4YrncO4UZo" },
    { marca: "Max Titanium", titulo: "Testimonial – Whey drink", categoria: "Fitness", gradiente: "grad-6", videoId: "KbJBIB5RHCI" },

    // Home & Decor
    { marca: "Condor", titulo: "Storytelling – PVA mop and lint roller", categoria: "Home & Decor", gradiente: "grad-5", videoId: "rjblZsgruDA" },
    { marca: "Eletrolux", titulo: "Educational – Water filter refill", categoria: "Home & Decor", gradiente: "grad-6", videoId: "e6SAuK22QwM" },
    { marca: "Shopee", titulo: "Marketplace – Waterproof mattress cover", categoria: "Home & Decor", gradiente: "grad-1", videoId: "AbXbrKyfHcQ" },
    { marca: "Shein", titulo: "Marketplace – Bedding set", categoria: "Home & Decor", gradiente: "grad-2", videoId: "vSGOS-KIKUE" },
    { marca: "Coala", titulo: "Testimonial – Black orchid scent kit", categoria: "Home & Decor", gradiente: "grad-3", videoId: "ogsVF7O7wMM" },

    // Pet (Natuka/Théo's video moved to the "Featured Content" section — same
    // video, now promoted, matching how the source doc splits it out too)
    { marca: "FreePet", titulo: "Storytelling – Kennel cleaner + odor neutralizer", categoria: "Pet", gradiente: "grad-1", videoId: "d1fmuHk5sEU" },
    { marca: "Petiko", titulo: "Fun unboxing – Treats and toys", categoria: "Pet", gradiente: "grad-2", videoId: "c6-PNqQZslE" },
    { marca: "Nutrafases", titulo: "Testimonial – Probiotic supplement", categoria: "Pet", gradiente: "grad-3", videoId: "t9FO_B2oydI" },
    { marca: "New Pet", titulo: "Storytelling – Smart water fountain", categoria: "Pet", gradiente: "grad-4", videoId: "pkf21wmwvvs" },

    // Beauty & Self-Care
    { marca: "Condor", titulo: "Storytelling – Makeup brushes", categoria: "Beauty & Self-Care", gradiente: "grad-5", videoId: "usONnfgOlzU" },
    { marca: "Alva", titulo: "Voiceover/Educational – Tongue scraper", categoria: "Beauty & Self-Care", gradiente: "grad-6", videoId: "k17j7zWKmuA" },
    { marca: "Mayara", titulo: "Experience – Eyebrow design", categoria: "Beauty & Self-Care", gradiente: "grad-1", videoId: "8K0wrl9mf0U" },
    { marca: "Condor", titulo: "Educational – Antibacterial toothbrush", categoria: "Beauty & Self-Care", gradiente: "grad-2", videoId: "M7HjEF0YcqU" },
    { marca: "Condor", titulo: "Tip – Hairbrush kit with coloring markers", categoria: "Beauty & Self-Care", gradiente: "grad-3", videoId: "rqMTFESTsAw" },
    { marca: "Alva", titulo: "Review – Crystal deodorant", categoria: "Beauty & Self-Care", gradiente: "grad-4", videoId: "vOmNzVuLXJw" },

    // Fashion & Accessories
    { marca: "Vans", titulo: "Creative – 1 sneaker, many looks", categoria: "Fashion & Accessories", gradiente: "grad-2", videoId: "80XKBvwlWfU" },
    { marca: "Ótica Mega Opção", titulo: "Organic – Prescription glasses", categoria: "Fashion & Accessories", gradiente: "grad-3", videoId: "_qhaRoUB1b0" },
    { marca: "Shein", titulo: "Great find – Pajamas", categoria: "Fashion & Accessories", gradiente: "grad-4", videoId: "Ycp2cp5_ps0" },
    { marca: "Saint Germain", titulo: "Showcase – Watch", categoria: "Fashion & Accessories", gradiente: "grad-5", videoId: "di5b_sg4_M8" },

    // Tech & Apps
    { marca: "Hollyland", titulo: "Comparison – Microphone", categoria: "Tech & Apps", gradiente: "grad-6", videoId: "KXBxVTr8PXA" },
    { marca: "Konta IA", titulo: "Storytelling – Finance organizer app", categoria: "Tech & Apps", gradiente: "grad-1", videoId: "v2zf26ctp98" },
    { marca: "Samsung", titulo: "ASMR unboxing – Tablet", categoria: "Tech & Apps", gradiente: "grad-2", videoId: "H7vk2JF62PM" },
    { marca: "Hollyland", titulo: "Tips – Microphone", categoria: "Tech & Apps", gradiente: "grad-3", videoId: "uCHl56vK6Zc" },

    // Services & Experiences
    { marca: "Dr. Lava Tudo", titulo: "Storytelling – Car detailing", categoria: "Services & Experiences", gradiente: "grad-5", videoId: "V2rAhr3_D7E" },
    { marca: "Show de Pizzaiolo", titulo: "Storytelling – At-home pizza buffet", categoria: "Services & Experiences", gradiente: "grad-6", videoId: "o9KozkhVU-E" },
    { marca: "Dr. Lava Tudo", titulo: "Storytelling – Sofa + mattress cleaning", categoria: "Services & Experiences", gradiente: "grad-1", videoId: "Y3b5WeKfBP0" },
    { marca: "Show de Pizzaiolo", titulo: "Paid traffic – At-home pizza buffet (franchisee-focused)", categoria: "Services & Experiences", gradiente: "grad-2", videoId: "7n_Mol2CiSM" },

    // Special Occasions (Clínica Panzerri first, order updated per VÍDEOS.docx)
    { marca: "Clínica Panzerri", titulo: "Storytelling – Mother's Day", categoria: "Special Occasions", gradiente: "grad-3", videoId: "0I-u5Lg0l1k" },
    { marca: "Yool", titulo: "June-festival podcast (twins creative) – Q&A, flared skirt", categoria: "Special Occasions", gradiente: "grad-4", videoId: "bzI86bSqRDQ" },
    { marca: "Yool", titulo: "Wall-mounted display (creative) – Various June-festival products", categoria: "Special Occasions", gradiente: "grad-5", videoId: "pvBmrnzCdHA" }
  ],

  fotosUgcTextos: {
    tag: "UGC Photos",
    tituloHtml: "I also do <span class=\"destaque-italico\">photos</span>."
  },

  fotosUgc: [
    { imagem: "/portfolio/imagens/foto-ugc-1.jpg", gradiente: "grad-1" },
    { imagem: "/portfolio/imagens/foto-ugc-2.jpg", gradiente: "grad-2" },
    { imagem: "/portfolio/imagens/foto-ugc-3.jpg", gradiente: "grad-3" },
    { imagem: "/portfolio/imagens/foto-ugc-4.jpg", gradiente: "grad-4" },
    { imagem: "/portfolio/imagens/foto-ugc-5.jpg", gradiente: "grad-5" },
    { imagem: "/portfolio/imagens/foto-ugc-6.jpg", gradiente: "grad-6" },
    { imagem: "/portfolio/imagens/foto-ugc-7.jpg", gradiente: "grad-1" },
    { imagem: "/portfolio/imagens/foto-ugc-8.jpg", gradiente: "grad-2" },
    { imagem: "/portfolio/imagens/foto-ugc-9.jpg", gradiente: "grad-3" },
    { imagem: "/portfolio/imagens/foto-ugc-10.jpg", gradiente: "grad-4" },
    { imagem: "/portfolio/imagens/foto-ugc-11.jpg", gradiente: "grad-5" },
    { imagem: "/portfolio/imagens/foto-ugc-12.jpg", gradiente: "grad-6" }
  ],

  servicosTextos: {
    tag: "Services",
    titulo: "What I can create for your brand",
    subtitulo: "Content designed to build trust, drive engagement, and above all, generate sales."
  },

  servicos: [
    { icone: "🎬", titulo: "UGC Video", descricao: "Strategic, sales-focused content creation for you to use on your own profile and in ads.", cta: "I want UGC that converts" },
    { icone: "🗂️", titulo: "UGC Manager", descricao: "Instead of creating, I'll fully manage campaigns with other UGC creators so you're free — handling everything from hiring to content delivery.", cta: "I want UGC management" },
    { icone: "📱", titulo: "Reels & TikToks", descricao: "Dynamic content, edited to the rhythm of social media and ready to post or use in ads.", cta: "I want social content" },
    { icone: "📸", titulo: "Product Photos", descricao: "Authentic, well-lit images that show your product in real everyday life.", cta: "I want product photos" },
    { icone: "📦", titulo: "Unboxing", descricao: "Unboxing videos with genuine reactions that spark the desire to buy in anyone watching.", cta: "I want an unboxing" },
    { icone: "⭐", titulo: "Testimonials & Reviews", descricao: "Honest, persuasive reviews that build audience trust in your brand.", cta: "I want real testimonials" },
    { icone: "🚀", titulo: "Ad Content", descricao: "Videos built to perform as paid ads, with a strong hook in the first seconds.", cta: "I want to create ads" },
    { icone: "🤝", titulo: "UGC + Collab", descricao: "Promotion to my own community, made in collaboration. My profile covers self-care and lifestyle.", cta: "I want to do a collab" }
  ],

  resultadosTextos: {
    tag: "Results",
    titulo: "Numbers that show my impact",
    subtitulo: "Real reach and delivery data that help brands decide with confidence."
  },

  resultados: [
    { numero: 85, sufixo: "k+", rotulo: "Social media followers", decimais: 0 },
    { numero: 1.5, sufixo: "M+", rotulo: "Views per month", decimais: 1 },
    { numero: 40, sufixo: "+", rotulo: "Brands served", decimais: 0 },
    { numero: 8.5, sufixo: "%", rotulo: "Average engagement rate", decimais: 1 }
  ],

  depoimentosTextos: {
    tag: "Feedback",
    titulo: "What brands say about my work",
    subtitulo: "Feedback from brands that experienced firsthand the power of strategic content."
  },

  // These are real screenshots, kept in Portuguese in both versions of the site (not translated).
  depoimentos: [
    // depoimento-1.jpg removido: esse print já aparece na seção "Conteúdos em Destaque".
    { imagem: "/portfolio/imagens/depoimento-2.jpg" },
    { imagem: "/portfolio/imagens/depoimento-3.jpg" },
    { imagem: "/portfolio/imagens/depoimento-4.jpg" },
    { imagem: "/portfolio/imagens/depoimento-5.jpg" },
    { imagem: "/portfolio/imagens/depoimento-6.jpg" },
    { imagem: "/portfolio/imagens/depoimento-7.jpg" },
    { imagem: "/portfolio/imagens/depoimento-8.jpg" },
    { imagem: "/portfolio/imagens/depoimento-9.jpg" },
    { imagem: "/portfolio/imagens/depoimento-10.jpg" }
  ],

  contatoTextos: {
    tag: "Contact",
    titulo: "Let's create your brand's next successful content?",
    subtitulo: "Message me right now and get a personalized proposal for your product.",
    labelNome: "Name",
    labelEmail: "Email",
    labelMarca: "Brand / Company",
    labelOrcamento: "Estimated budget",
    labelMensagem: "Tell me about the project",
    placeholderNome: "Your name",
    placeholderEmail: "you@brand.com",
    placeholderMarca: "Brand name",
    placeholderOrcamento: "E.g. $200 to $1,000",
    placeholderMensagem: "Category, format, deadline, campaign goal...",
    botaoEnviar: "Send message",
    botaoEnviando: "Sending...",
    mensagemSucesso: "Thanks for reaching out! I've received your message and will reply soon.",
    mensagemErro: "I couldn't send your message right now. Please try again or message me directly on WhatsApp."
  },

  rodape: {
    copyrightTexto: "All rights reserved."
  }
};
