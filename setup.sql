-- =====================================================================
-- setup.sql
-- Rode este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/dqtoxxngjqyoibdgmrjr/sql/new
-- Selecione tudo, cole lá e clique em "Run".
-- =====================================================================

-- Tabela de eventos do site (visitas, cliques em botões, visualizações de vídeo)
create table if not exists public.portfolio_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,        -- 'page_view' | 'button_click' | 'video_view'
  event_name text,                 -- nome do evento (ex: 'contact_whatsapp', id do vídeo no YouTube)
  session_id text,                 -- identifica um visitante dentro de uma sessão de navegação
  page_path text,                  -- caminho da página onde o evento aconteceu
  metadata jsonb,                  -- dados extras (title, brand, category, etc.)
  visitor_hash text,               -- hash do IP de quem visitou, preenchido sozinho (ver trigger abaixo)
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Visitantes únicos por IP (em vez de por sessão do navegador)
-- session_id muda toda vez que a pessoa abre uma aba nova, então duas
-- visitas da mesma pessoa contavam como "2 visitantes únicos". Essa trigger
-- lê o IP de quem fez a requisição (cabeçalho x-forwarded-for) e grava um
-- hash dele (não o IP em texto puro, por privacidade) na coluna acima,
-- automaticamente, a cada novo evento.
-- =====================================================================
create extension if not exists pgcrypto;

create or replace function public.set_portfolio_visitor_hash()
returns trigger
language plpgsql
as $$
declare
  ip text;
begin
  ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  if ip is not null and trim(ip) <> '' then
    new.visitor_hash := encode(digest(trim(ip), 'sha256'), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_portfolio_visitor_hash on public.portfolio_events;
create trigger trg_set_portfolio_visitor_hash
  before insert on public.portfolio_events
  for each row execute function public.set_portfolio_visitor_hash();

-- Tabela de mensagens recebidas pelo formulário de contato e pelo popup do site
create table if not exists public.portfolio_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  brand text,
  budget text,
  message text,
  source text,                     -- 'contact' | 'popup'
  lida boolean not null default false, -- true depois que você abre a mensagem no painel
  created_at timestamptz not null default now()
);

-- Índices para acelerar as consultas que o painel mais faz
create index if not exists idx_portfolio_events_created_at on public.portfolio_events (created_at desc);
create index if not exists idx_portfolio_events_type on public.portfolio_events (event_type);
create index if not exists idx_portfolio_leads_created_at on public.portfolio_leads (created_at desc);

-- Ativa o Row Level Security nas duas tabelas (nenhum dado é público por padrão)
alter table public.portfolio_events enable row level security;
alter table public.portfolio_leads enable row level security;

-- Permite que qualquer usuário AUTENTICADO (você, logada no painel) possa LER
-- os dados das duas tabelas. Sem essa policy, o painel não consegue ler nada
-- mesmo você estando logada.
drop policy if exists "Usuarios autenticados podem ler eventos" on public.portfolio_events;
create policy "Usuarios autenticados podem ler eventos"
  on public.portfolio_events
  for select
  to authenticated
  using (true);

drop policy if exists "Usuarios autenticados podem ler leads" on public.portfolio_leads;
create policy "Usuarios autenticados podem ler leads"
  on public.portfolio_leads
  for select
  to authenticated
  using (true);

-- Permite marcar mensagens como lidas (bolinha vermelha de não lidas no painel)
drop policy if exists "Usuarios autenticados podem atualizar leads" on public.portfolio_leads;
create policy "Usuarios autenticados podem atualizar leads"
  on public.portfolio_leads
  for update
  to authenticated
  using (true)
  with check (true);

-- As policies acima controlam QUAIS LINHAS podem ser lidas, mas o Postgres
-- exige tambem uma permissao basica de acesso a tabela em si. Quando as
-- tabelas sao criadas pela interface do Supabase isso e feito automatico,
-- mas como criamos via SQL, precisamos liberar explicitamente:
grant usage on schema public to authenticated;
grant select on public.portfolio_events to authenticated;
grant select, update on public.portfolio_leads to authenticated;

-- =====================================================================
-- GRAVAÇÃO DOS EVENTOS E MENSAGENS (feita pelo navegador do visitante)
--
-- O portfólio (index.html) é um site 100% estático, sem servidor próprio,
-- por isso a gravação dos eventos (visitas, cliques, vídeos assistidos)
-- e das mensagens de contato é feita direto pelo navegador do visitante,
-- usando a mesma chave pública ("anon"). Essas policies permitem GRAVAR
-- mas não permitem LER: com a chave anon, qualquer pessoa pode enviar um
-- evento ou uma mensagem, mas ninguém além de você (logada) consegue ler
-- o que já foi enviado. Isso é o equilíbrio possível para um site sem
-- servidor; o único risco real é alguém conseguir inserir eventos falsos
-- (poluindo as estatísticas), não vazamento de dados.
-- =====================================================================
drop policy if exists "Visitantes podem registrar eventos" on public.portfolio_events;
create policy "Visitantes podem registrar eventos"
  on public.portfolio_events
  for insert
  to anon
  with check (true);

drop policy if exists "Visitantes podem enviar mensagens" on public.portfolio_leads;
create policy "Visitantes podem enviar mensagens"
  on public.portfolio_leads
  for insert
  to anon
  with check (true);

grant usage on schema public to anon;
grant insert on public.portfolio_events to anon;
grant insert on public.portfolio_leads to anon;

-- =====================================================================
-- AGENDA / PLANNER DIÁRIO (aba "Agenda" do painel)
-- Tabela de tarefas do planner. Só você (autenticada) lê e escreve aqui,
-- é uma ferramenta pessoal de organização dentro do painel.
-- =====================================================================
create table if not exists public.painel_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  emoji text,                      -- emoji solto (ex: '🐾', '💻')
  data date not null,              -- dia da tarefa (AAAA-MM-DD)
  concluida boolean not null default false,
  cor integer not null default 0,  -- índice de 0 a 4 escolhendo a cor do cartão
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_tarefas_data on public.painel_tarefas (data);

alter table public.painel_tarefas enable row level security;

drop policy if exists "Usuaria autenticada gerencia suas tarefas" on public.painel_tarefas;
create policy "Usuaria autenticada gerencia suas tarefas"
  on public.painel_tarefas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_tarefas to authenticated;

-- =====================================================================
-- CLIENTES (aba "Clientes" do painel)
-- Cadastro de clientes/parceiros, separado da aba Abordagem (que registra
-- toda marca abordada, mesmo antes de virar cliente). Aqui só entram
-- marcas já cadastradas como cliente/contato, organizadas em 3 etapas:
-- 'contatos' (Base de Contatos) | 'abordagem' (Em Abordagem, negociando)
-- | 'historico' (Histórico de Clientes, encerrado).
-- =====================================================================
create table if not exists public.painel_clientes (
  id uuid primary key default gen_random_uuid(),
  nome_marca text not null,
  cnpj text,
  nicho text,
  instagram text,
  tiktok text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  ja_trabalhou boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  etapa text not null default 'contatos' check (etapa in ('contatos', 'abordagem', 'historico')),
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_clientes_etapa on public.painel_clientes (etapa);
create index if not exists idx_painel_clientes_status on public.painel_clientes (status);

-- Detalhe livre do nicho quando "nicho" = 'Outro'. Se a tabela já existia de uma
-- versão anterior, essa linha adiciona a coluna sem apagar nada.
alter table public.painel_clientes add column if not exists nicho_detalhe text;

alter table public.painel_clientes enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus clientes" on public.painel_clientes;
create policy "Usuaria autenticada gerencia seus clientes"
  on public.painel_clientes
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_clientes to authenticated;

-- =====================================================================
-- PROJETOS (aba "Projetos" do painel)
-- Cada trabalho/entrega, opcionalmente ligado a um cliente da tabela acima.
-- =====================================================================
create table if not exists public.painel_projetos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cliente_id uuid references public.painel_clientes(id) on delete set null,
  status text not null default 'a_fazer',  -- 'a_fazer' | 'em_andamento' | 'entregue' | 'pago'
  data_entrega date,
  valor numeric(10,2),
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_projetos_status on public.painel_projetos (status);
create index if not exists idx_painel_projetos_cliente on public.painel_projetos (cliente_id);

alter table public.painel_projetos enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus projetos" on public.painel_projetos;
create policy "Usuaria autenticada gerencia seus projetos"
  on public.painel_projetos
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_projetos to authenticated;

-- =====================================================================
-- BANCO CRIATIVO (aba "Banco Criativo" do painel)
-- Biblioteca de referências, roteiros, briefings e materiais, opcionalmente
-- ligados a um projeto da tabela acima.
-- =====================================================================
create table if not exists public.painel_banco_criativo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null,              -- 'imagem' | 'video' | 'roteiro' | 'referencia' | 'brief'
  url text,
  projeto_id uuid references public.painel_projetos(id) on delete set null,
  tags text[],
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_banco_criativo_tipo on public.painel_banco_criativo (tipo);
create index if not exists idx_painel_banco_criativo_projeto on public.painel_banco_criativo (projeto_id);

alter table public.painel_banco_criativo enable row level security;

drop policy if exists "Usuaria autenticada gerencia seu banco criativo" on public.painel_banco_criativo;
create policy "Usuaria autenticada gerencia seu banco criativo"
  on public.painel_banco_criativo
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_banco_criativo to authenticated;

-- =====================================================================
-- UGC CREATOR (aba "UGC Creator" do painel)
-- Quadro Kanban dos trabalhos fechados como criadora de conteudo, do lead
-- ate o pagamento. Quando um trabalho e marcado como "A pagar" ou "Pago",
-- gera/atualiza uma linha em negocio_lancamentos (mesma tabela da aba
-- Financeiro UGC), pra nao duplicar cadastro entre as duas abas.
-- =====================================================================
create table if not exists public.painel_ugc_trabalhos (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  origem text,                          -- 'Inbound' | 'Outbound'
  tipo_trabalho text,
  valor numeric(10,2),
  data_fechamento date,
  data_pagamento_prevista date,
  data_entrega date,                    -- prazo de entrega do conteudo pra marca
  etapa text not null default 'novo_lead',
  -- 'novo_lead' | 'briefing_recebido' | 'roteiro' | 'gravar' | 'editar' | 'entregue' | 'pago' | 'arquivado'
  briefing_url text,                    -- link do briefing (Drive, etc.)
  roteiro_texto text,
  roteiro_aprovado boolean not null default false,
  edicao_aprovada boolean not null default false,
  status_pagamento text,                -- null | 'a_pagar' | 'pago'
  negocio_lancamento_id uuid references public.negocio_lancamentos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_ugc_trabalhos_etapa on public.painel_ugc_trabalhos (etapa);
create index if not exists idx_painel_ugc_trabalhos_data_entrega on public.painel_ugc_trabalhos (data_entrega);

-- Contrato ativo + período de tráfego pago rodando pra esse trabalho. Se a tabela já
-- existia de uma versão anterior, essas linhas adicionam as colunas sem apagar nada.
alter table public.painel_ugc_trabalhos add column if not exists contrato_ativo boolean not null default false;
alter table public.painel_ugc_trabalhos add column if not exists trafego_pago_inicio date;
alter table public.painel_ugc_trabalhos add column if not exists trafego_pago_fim date;
create index if not exists idx_painel_ugc_trabalhos_trafego_fim on public.painel_ugc_trabalhos (trafego_pago_fim);

-- Vínculo com o Cliente oficial (aba Clientes). A coluna "marca" continua existindo e
-- não é mais preenchida à mão: ela vira um retrato do nome do cliente escolhido no
-- momento do vínculo, então o resto do painel (listas, kanban, sincronização com o
-- Financeiro UGC) não precisa mudar. Trabalhos antigos ficam com cliente_id nulo até
-- serem vinculados manualmente na tela de edição — isso é opcional, não obrigatório.
alter table public.painel_ugc_trabalhos add column if not exists cliente_id uuid references public.painel_clientes(id) on delete set null;
create index if not exists idx_painel_ugc_trabalhos_cliente on public.painel_ugc_trabalhos (cliente_id);

alter table public.painel_ugc_trabalhos enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus trabalhos UGC" on public.painel_ugc_trabalhos;
create policy "Usuaria autenticada gerencia seus trabalhos UGC"
  on public.painel_ugc_trabalhos
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_ugc_trabalhos to authenticated;

-- =====================================================================
-- IA: CRÔ + NEGOCIAÇÃO (histórico de conversa dos 6 assistentes de IA)
-- Uma linha por mensagem. "contexto" separa as 6 conversas independentes,
-- cada uma com seu próprio histórico:
-- cro_abordagem | cro_estudo_produto | cro_roteiro_ugc | cro_roteiro_insta
-- negociacao_normais | negociacao_criativos
-- As respostas da IA vêm de uma Supabase Edge Function ("ia-assistente")
-- que guarda a chave da Anthropic em segredo — ver README/instruções de deploy.
-- =====================================================================
create table if not exists public.painel_ia_mensagens (
  id uuid primary key default gen_random_uuid(),
  contexto text not null check (contexto in (
    'cro_abordagem', 'cro_estudo_produto', 'cro_roteiro_ugc', 'cro_roteiro_insta',
    'negociacao_normais', 'negociacao_criativos'
  )),
  papel text not null check (papel in ('user', 'assistant')),
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_ia_mensagens_contexto on public.painel_ia_mensagens (contexto, created_at);

alter table public.painel_ia_mensagens enable row level security;

drop policy if exists "Usuaria autenticada gerencia suas mensagens de IA" on public.painel_ia_mensagens;
create policy "Usuaria autenticada gerencia suas mensagens de IA"
  on public.painel_ia_mensagens
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_ia_mensagens to authenticated;

-- =====================================================================
-- ABORDAGEM (aba "Abordagem" do painel)
-- Registro das marcas abordadas: o que foi a abordagem, quando foi feita
-- e a data do follow up (sempre 7 dias depois da abordagem). O painel usa
-- data_followup pra mostrar um lembrete quando a data chegar.
-- =====================================================================
create table if not exists public.painel_abordagens (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  produto text,
  abordagem text,                       -- o que foi enviado/falado na abordagem
  data_abordagem date,
  data_followup date,                   -- calculada no app como data_abordagem + 7 dias
  observacao text,
  status text not null default 'andamento' check (status in ('andamento', 'fechada', 'sem_retorno')),
  -- 'andamento' = Negociação em andamento | 'fechada' = Negociação fechada | 'sem_retorno' = Sem retorno
  followup_feito boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_abordagens_data_followup on public.painel_abordagens (data_followup);
create index if not exists idx_painel_abordagens_status on public.painel_abordagens (status);

-- Se a tabela já existia de uma versão anterior (sem a coluna "arquivado"), essa linha
-- adiciona ela sem apagar nada. Rodar de novo depois que a tabela já foi criada é seguro.
alter table public.painel_abordagens add column if not exists arquivado boolean not null default false;
create index if not exists idx_painel_abordagens_arquivado on public.painel_abordagens (arquivado);

-- Vínculo com o Cliente oficial depois que a negociação fecha e o cadastro é completado
-- (aba Clientes). Fica null até isso acontecer — é o que o painel usa pra saber quais
-- negociações fechadas ainda têm pendência de cadastro.
alter table public.painel_abordagens add column if not exists cliente_id uuid references public.painel_clientes(id) on delete set null;
create index if not exists idx_painel_abordagens_cliente on public.painel_abordagens (cliente_id);

-- Canal por onde a abordagem foi feita (formulário/Instagram/e-mail/plataforma) + o
-- detalhe específico daquele canal (link, @, e-mail ou nome da plataforma).
alter table public.painel_abordagens add column if not exists canal text check (canal in ('formulario', 'instagram', 'email', 'plataforma'));
alter table public.painel_abordagens add column if not exists canal_detalhe text;

-- Nicho da marca abordada — campo independente do Cliente (a abordagem pode nunca virar
-- cliente oficial), mesmas opções usadas no cadastro de Cliente, com "Outro" + detalhe livre.
alter table public.painel_abordagens add column if not exists nicho text;
alter table public.painel_abordagens add column if not exists nicho_detalhe text;

-- Status foi evoluindo em duas rodadas (nasceu com 'andamento/fechada/sem_retorno', depois
-- ganhou 'realizada', depois ganhou 'rascunho') — mas recriar a constraint em duas etapas
-- separadas, cada uma com uma lista de valores incompleta, trava ao rodar de novo assim que
-- já existem linhas reais com status='rascunho' (a etapa intermediária ainda não aceitava
-- esse valor). Por isso agora é uma única troca, direto pra lista final.
alter table public.painel_abordagens drop constraint if exists painel_abordagens_status_check;
alter table public.painel_abordagens add constraint painel_abordagens_status_check
  check (status in ('rascunho', 'realizada', 'andamento', 'fechada', 'sem_retorno'));
alter table public.painel_abordagens alter column status set default 'rascunho';
alter table public.painel_abordagens add column if not exists data_rascunho date;

alter table public.painel_abordagens enable row level security;

drop policy if exists "Usuaria autenticada gerencia suas abordagens" on public.painel_abordagens;
create policy "Usuaria autenticada gerencia suas abordagens"
  on public.painel_abordagens
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_abordagens to authenticated;

-- =====================================================================
-- BLOCO DE NOTAS (aba "Ideias Criativas" do painel)
-- Notas soltas coloridas, tipo post-it, pra anotar ideias/rascunhos/brainstorms rápido.
-- =====================================================================
create table if not exists public.painel_notas (
  id uuid primary key default gen_random_uuid(),
  conteudo text not null default '',
  cor text not null default 'azul' check (cor in ('amarelo', 'rosa', 'azul', 'verde', 'cinza', 'vermelho', 'roxo', 'laranja')),
  link text,                            -- link de referência opcional (Pinterest, Drive, etc.)
  fechada boolean not null default false, -- true depois que a pessoa clica em "Salvar" (vira o post-it compacto)
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_notas_cor on public.painel_notas (cor);

-- Se a tabela já existia de uma versão anterior (sem as colunas "link"/"fechada"), essas
-- linhas adicionam elas sem apagar nada. Rodar de novo depois que a tabela já existe é seguro.
alter table public.painel_notas add column if not exists link text;
alter table public.painel_notas add column if not exists fechada boolean not null default false;

alter table public.painel_notas enable row level security;

drop policy if exists "Usuaria autenticada gerencia suas notas" on public.painel_notas;
create policy "Usuaria autenticada gerencia suas notas"
  on public.painel_notas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_notas to authenticated;

-- =====================================================================
-- LEMBRETES: adiamento persistido (pop-up de notificações do painel)
-- Uma linha por "grupo" de lembrete (abordagem, financas, agenda, portfolio,
-- clientes, ugc-creator, negocio). Guarda até quando aquele grupo foi adiado
-- via "Lembrar em 1h", pra sobreviver a F5 e funcionar igual em qualquer
-- aparelho (antes isso ficava só numa variável do JavaScript, perdida a
-- cada recarregamento da página).
-- =====================================================================
create table if not exists public.painel_lembretes_snooze (
  grupo text primary key,
  adiado_ate timestamptz,
  created_at timestamptz not null default now(), -- exigido por buscarTudo() no painel.html, que ordena por essa coluna em toda tabela
  updated_at timestamptz not null default now()
);

alter table public.painel_lembretes_snooze enable row level security;

drop policy if exists "Usuaria autenticada gerencia lembretes_snooze" on public.painel_lembretes_snooze;
create policy "Usuaria autenticada gerencia lembretes_snooze"
  on public.painel_lembretes_snooze
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_lembretes_snooze to authenticated;

-- =====================================================================
-- INSTAGRAM: AUTOMAÇÃO DE DM (aba "Instagram > Automações" do painel)
-- Motor de automação estilo ManyChat: um comentário com palavra-chave
-- dispara uma DM com botões, e a pessoa pode continuar tocando neles.
-- As Edge Functions (instagram-webhook, ig-scheduler, ig-token-refresh,
-- ig-insights, ig-media) usam a chave de service_role pra ler/escrever
-- aqui, então funcionam mesmo com o RLS ligado.
-- =====================================================================

-- Automações cadastradas no editor visual do painel. flow guarda a
-- conversa inteira em jsonb (a Mensagem 1 é sempre o primeiro item do
-- array flow->steps), no formato montado por igMontarFlow() no
-- painel.html. Não existem colunas separadas de "mensagem"/"link": tudo
-- mora dentro de flow, pra não duplicar caminhos.
create table if not exists public.ig_automations (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Sem nome',
  keyword text not null default '',           -- palavras separadas por vírgula, vazio quando match_any = true
  match_any boolean not null default false,
  active boolean not null default true,
  media_ids text[] not null default '{}',     -- posts em que a automação vale; vazio = todos os posts
  public_reply text not null default '',
  public_reply_variants text[] not null default '{}',
  flow jsonb not null default '{"steps":[]}'::jsonb,
  asset_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ig_automations_active on public.ig_automations (active);

alter table public.ig_automations enable row level security;

drop policy if exists "Usuaria autenticada gerencia as automacoes do Instagram" on public.ig_automations;
create policy "Usuaria autenticada gerencia as automacoes do Instagram"
  on public.ig_automations
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.ig_automations to authenticated;

-- Leads/contatos capturados pelas automações: uma linha por pessoa do
-- Instagram que já interagiu. flow_step guarda em que passo da conversa
-- ela está (pro postback saber pra onde avançar) e expecting guarda
-- quando um passo está esperando ela responder com um dado (e-mail/telefone).
create table if not exists public.ig_leads (
  ig_user_id text primary key,
  username text,
  last_source text check (last_source in ('comment', 'dm', 'story_reply')),
  last_keyword text,
  automation_id uuid references public.ig_automations(id) on delete set null,
  flow_step text,
  link_sent boolean not null default false,
  expecting jsonb,
  tags text[] not null default '{}',
  email text,
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ig_leads_automation on public.ig_leads (automation_id);
create index if not exists idx_ig_leads_updated_at on public.ig_leads (updated_at desc);

alter table public.ig_leads enable row level security;

drop policy if exists "Usuaria autenticada le e gerencia os leads do Instagram" on public.ig_leads;
create policy "Usuaria autenticada le e gerencia os leads do Instagram"
  on public.ig_leads
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.ig_leads to authenticated;

-- Log de cada envio (sucesso, erro ou colocado na fila), pra auditoria e
-- pra debugar quando uma automação "não está funcionando".
create table if not exists public.ig_deliveries (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text,
  automation_id uuid references public.ig_automations(id) on delete set null,
  canal text check (canal in ('private_reply', 'dm')),
  tipo text check (tipo in ('flow', 'link', 'text')),
  status text not null check (status in ('ok', 'erro', 'na_fila')),
  motivo text,
  ts timestamptz not null default now()
);

create index if not exists idx_ig_deliveries_ts on public.ig_deliveries (ts desc);
create index if not exists idx_ig_deliveries_automation on public.ig_deliveries (automation_id);

alter table public.ig_deliveries enable row level security;

drop policy if exists "Usuaria autenticada le os envios do Instagram" on public.ig_deliveries;
create policy "Usuaria autenticada le os envios do Instagram"
  on public.ig_deliveries
  for select
  to authenticated
  using (true);

grant select on public.ig_deliveries to authenticated;

-- Fila de envios represados pelo freio (rate limit). O ig-scheduler
-- esvazia essa fila a cada 1 minuto, respeitando o teto de envio.
create table if not exists public.ig_send_queue (
  id uuid primary key default gen_random_uuid(),
  comment_id text unique not null,
  automation_id uuid references public.ig_automations(id) on delete cascade,
  ig_user_id text not null,
  username text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro', 'expirado')),
  tentativas int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);

create index if not exists idx_ig_send_queue_status on public.ig_send_queue (status);
create index if not exists idx_ig_send_queue_created_at on public.ig_send_queue (created_at);

alter table public.ig_send_queue enable row level security;

drop policy if exists "Usuaria autenticada le a fila de envio do Instagram" on public.ig_send_queue;
create policy "Usuaria autenticada le a fila de envio do Instagram"
  on public.ig_send_queue
  for select
  to authenticated
  using (true);

grant select on public.ig_send_queue to authenticated;

-- O CONTADOR do freio (token bucket). Uma linha só por "chave" de envio
-- (usamos "private_reply" como chave única). As funções
-- take_send_slot/record_send_result abaixo leem e escrevem aqui com
-- trava atômica (FOR UPDATE), pra não estourar o teto mesmo com dois
-- envios acontecendo ao mesmo tempo.
create table if not exists public.ig_send_budget (
  id text primary key,
  minuto_inicio timestamptz not null default now(),
  minuto_contagem int not null default 0,
  hora_inicio timestamptz not null default now(),
  hora_contagem int not null default 0,
  dia_inicio timestamptz not null default now(),
  dia_contagem int not null default 0,
  falhas_seguidas int not null default 0,
  pausado_ate timestamptz,
  teto_minuto int not null default 6,
  teto_hora int not null default 60,
  teto_dia int not null default 180,
  updated_at timestamptz not null default now()
);

alter table public.ig_send_budget enable row level security;

drop policy if exists "Usuaria autenticada le o freio de envio do Instagram" on public.ig_send_budget;
create policy "Usuaria autenticada le o freio de envio do Instagram"
  on public.ig_send_budget
  for select
  to authenticated
  using (true);

grant select on public.ig_send_budget to authenticated;

-- Linha inicial do freio (seed). "on conflict do nothing" faz esse bloco
-- ser seguro de rodar de novo sem duplicar ou resetar contadores já em uso.
insert into public.ig_send_budget (id, teto_minuto, teto_hora, teto_dia)
values ('private_reply', 6, 60, 180)
on conflict (id) do nothing;

-- Passos com atraso: quando um passo do flow tem { delay: { seconds, next } },
-- o envio dele fica agendado aqui e o ig-scheduler manda quando a hora chegar.
create table if not exists public.ig_scheduled (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  automation_id uuid references public.ig_automations(id) on delete cascade,
  step_id int not null,
  send_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ig_scheduled_pendentes on public.ig_scheduled (send_at) where sent = false;

alter table public.ig_scheduled enable row level security;

drop policy if exists "Usuaria autenticada le os passos agendados do Instagram" on public.ig_scheduled;
create policy "Usuaria autenticada le os passos agendados do Instagram"
  on public.ig_scheduled
  for select
  to authenticated
  using (true);

grant select on public.ig_scheduled to authenticated;

-- Arquivos (PDF, áudio, foto, vídeo) que podem ser anexados a um passo da
-- automação. A biblioteca de upload em si é uma fase futura; a tabela já
-- fica pronta.
create table if not exists public.ig_assets (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('image', 'audio', 'video', 'file')),
  public_url text not null,
  attachment_id text,          -- cache do id que o Instagram devolve depois do 1º envio, evita reenviar o arquivo toda vez
  size_bytes bigint,
  created_at timestamptz not null default now()
);

alter table public.ig_assets enable row level security;

drop policy if exists "Usuaria autenticada gerencia os arquivos do Instagram" on public.ig_assets;
create policy "Usuaria autenticada gerencia os arquivos do Instagram"
  on public.ig_assets
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.ig_assets to authenticated;

-- Status do token de acesso de longa duração (~60 dias). O ig-token-refresh
-- roda 1x por semana e atualiza essa linha.
create table if not exists public.ig_token_status (
  id text primary key default 'main',
  expires_at timestamptz,
  last_ok boolean not null default true,
  last_error text,
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ig_token_status enable row level security;

drop policy if exists "Usuaria autenticada le o status do token do Instagram" on public.ig_token_status;
create policy "Usuaria autenticada le o status do token do Instagram"
  on public.ig_token_status
  for select
  to authenticated
  using (true);

grant select on public.ig_token_status to authenticated;

insert into public.ig_token_status (id) values ('main') on conflict (id) do nothing;

-- Ids das mensagens que o PRÓPRIO sistema mandou (mid do Instagram). O
-- webhook grava aqui cada mid enviado e, ao receber um evento de "echo"
-- (mensagem que a própria conta mandou), confere essa tabela pra não se
-- confundir uma resposta manual com um envio automático.
create table if not exists public.ig_bot_sends (
  mid text primary key,
  created_at timestamptz not null default now()
);

alter table public.ig_bot_sends enable row level security;

drop policy if exists "Usuaria autenticada le os envios do bot" on public.ig_bot_sends;
create policy "Usuaria autenticada le os envios do bot"
  on public.ig_bot_sends
  for select
  to authenticated
  using (true);

grant select on public.ig_bot_sends to authenticated;

-- Registro de TODO comentário recebido (bate ou não uma automação), usado pra
-- montar "quem mais comenta", os números por canal e as análises de conteúdo
-- da aba Instagram > Análises. Diferente de ig_deliveries (que só guarda
-- os envios de fato), aqui entra o comentário mesmo quando nenhuma automação
-- responde a ele.
create table if not exists public.ig_comments (
  id uuid primary key default gen_random_uuid(),
  comment_id text unique not null,
  ig_user_id text not null,
  username text,
  media_id text,
  texto text,
  automation_id uuid references public.ig_automations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ig_comments_created_at on public.ig_comments (created_at desc);
create index if not exists idx_ig_comments_ig_user_id on public.ig_comments (ig_user_id);

alter table public.ig_comments enable row level security;

drop policy if exists "Usuaria autenticada le os comentarios do Instagram" on public.ig_comments;
create policy "Usuaria autenticada le os comentarios do Instagram"
  on public.ig_comments
  for select
  to authenticated
  using (true);

grant select on public.ig_comments to authenticated;

-- =====================================================================
-- FREIO DE ENVIO (token bucket + disjuntor)
--
-- take_send_slot: tenta pegar uma ficha de envio. Reseta os contadores
-- quando o minuto/hora/dia atual já virou, e nega (retorna false) se
-- qualquer um dos tetos já foi atingido ou se o disjuntor está pausando.
-- SEM ESSA FUNÇÃO, o freio falha fechado e nenhuma DM por comentário sai:
-- é o passo que não pode faltar.
--
-- record_send_result: registra se o envio deu certo ou não, pra alimentar
-- o disjuntor. p_hard = true é uma falha "dura" (ex: bloqueio da Meta);
-- 3 falhas duras seguidas pausam os envios por 3 horas.
-- =====================================================================

create or replace function public.take_send_slot(p_key text)
returns boolean
language plpgsql
as $$
declare
  linha public.ig_send_budget%rowtype;
  agora timestamptz := now();
begin
  select * into linha from public.ig_send_budget where id = p_key for update;

  if not found then
    insert into public.ig_send_budget (id) values (p_key)
    on conflict (id) do nothing;
    select * into linha from public.ig_send_budget where id = p_key for update;
  end if;

  -- Disjuntor: se está pausado, nega direto
  if linha.pausado_ate is not null and linha.pausado_ate > agora then
    return false;
  end if;

  -- Reseta as janelas que já viraram
  if agora - linha.minuto_inicio >= interval '1 minute' then
    linha.minuto_inicio := agora;
    linha.minuto_contagem := 0;
  end if;
  if agora - linha.hora_inicio >= interval '1 hour' then
    linha.hora_inicio := agora;
    linha.hora_contagem := 0;
  end if;
  if agora - linha.dia_inicio >= interval '1 day' then
    linha.dia_inicio := agora;
    linha.dia_contagem := 0;
  end if;

  -- Nega se qualquer teto já foi atingido, mas ainda assim persiste os
  -- resets de janela acima (senão a janela nunca vira quando o teto está cheio)
  if linha.minuto_contagem >= linha.teto_minuto
     or linha.hora_contagem >= linha.teto_hora
     or linha.dia_contagem >= linha.teto_dia then
    update public.ig_send_budget set
      minuto_inicio = linha.minuto_inicio, minuto_contagem = linha.minuto_contagem,
      hora_inicio = linha.hora_inicio, hora_contagem = linha.hora_contagem,
      dia_inicio = linha.dia_inicio, dia_contagem = linha.dia_contagem,
      updated_at = agora
    where id = p_key;
    return false;
  end if;

  -- Ficha concedida: soma 1 em todas as janelas
  update public.ig_send_budget set
    minuto_inicio = linha.minuto_inicio, minuto_contagem = linha.minuto_contagem + 1,
    hora_inicio = linha.hora_inicio, hora_contagem = linha.hora_contagem + 1,
    dia_inicio = linha.dia_inicio, dia_contagem = linha.dia_contagem + 1,
    updated_at = agora
  where id = p_key;

  return true;
end;
$$;

create or replace function public.record_send_result(p_key text, p_ok boolean, p_hard boolean)
returns void
language plpgsql
as $$
declare
  linha public.ig_send_budget%rowtype;
  agora timestamptz := now();
begin
  select * into linha from public.ig_send_budget where id = p_key for update;
  if not found then
    return;
  end if;

  if p_ok then
    update public.ig_send_budget set falhas_seguidas = 0, updated_at = agora where id = p_key;
    return;
  end if;

  if p_hard then
    if linha.falhas_seguidas + 1 >= 3 then
      update public.ig_send_budget set
        falhas_seguidas = 0,
        pausado_ate = agora + interval '3 hours',
        updated_at = agora
      where id = p_key;
    else
      update public.ig_send_budget set
        falhas_seguidas = linha.falhas_seguidas + 1,
        updated_at = agora
      where id = p_key;
    end if;
  end if;
end;
$$;

grant execute on function public.take_send_slot(text) to service_role;
grant execute on function public.record_send_result(text, boolean, boolean) to service_role;

-- =====================================================================
-- AGENDAMENTO (pg_cron + pg_net)
-- Chama o ig-scheduler a cada 1 minuto e o ig-token-refresh 1x por semana.
--
-- EDITE AQUI antes de rodar: troque SEU_PROJETO pela referência do seu
-- projeto Supabase (aparece na URL do painel do projeto, ex:
-- dqtoxxngjqyoibdgmrjr) e SEU_SCHED_SECRET pelo mesmo valor que você
-- configurar no segredo SCHED_SECRET das Edge Functions (ver LEIA-ME).
-- Rode este bloco por último, depois de publicar as duas funções.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ig-scheduler-cada-minuto',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/ig-scheduler',
    headers := jsonb_build_object('x-sched-key', 'SEU_SCHED_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'ig-token-refresh-semanal',
  '0 3 * * 1',
  $$
  select net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/ig-token-refresh',
    headers := jsonb_build_object('x-sched-key', 'SEU_SCHED_SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================================
-- ADMINISTRATIVO > JURÍDICO: licenciamento dos trabalhos UGC
-- Preenchido no formulário que abre quando a negociação é marcada como
-- "Fechada" na aba Abordagem. contrato_arquivo_url aponta pro Storage
-- (bucket "documentos-juridicos", ver mais abaixo).
-- =====================================================================
alter table public.painel_ugc_trabalhos add column if not exists contrato_arquivo_url text;
alter table public.painel_ugc_trabalhos add column if not exists contrato_arquivo_nome text;
alter table public.painel_ugc_trabalhos add column if not exists quantidade_videos integer;

-- =====================================================================
-- ADMINISTRATIVO > MEUS DOCUMENTOS
-- Uma linha só (perfil da própria usuária, não por trabalho/cliente).
-- Nenhum campo obrigatório: ela preenche aos poucos.
-- =====================================================================
create table if not exists public.painel_documentos_pessoais (
  id uuid primary key default gen_random_uuid(),
  nome_completo text,
  nome_empresarial text,
  cpf text,
  cnpj text,
  cartao_cnpj_url text,
  cartao_cnpj_nome text,
  updated_at timestamptz not null default now()
);

-- exigido por buscarTudo() no painel.html, que ordena por essa coluna em toda tabela
alter table public.painel_documentos_pessoais add column if not exists created_at timestamptz not null default now();

alter table public.painel_documentos_pessoais enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus documentos pessoais" on public.painel_documentos_pessoais;
create policy "Usuaria autenticada gerencia seus documentos pessoais"
  on public.painel_documentos_pessoais
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_documentos_pessoais to authenticated;

-- Documentos avulsos (RG, CNH, e qualquer outro que ela queira anexar depois).
-- Tabela separada porque a lista é livre — ela pode adicionar quantos tipos quiser.
create table if not exists public.painel_documentos_avulsos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,             -- rótulo digitado por ela, ex: "RG", "CNH", "Comprovante de endereço"
  arquivo_url text,
  arquivo_nome text,
  created_at timestamptz not null default now()
);

alter table public.painel_documentos_avulsos enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus documentos avulsos" on public.painel_documentos_avulsos;
create policy "Usuaria autenticada gerencia seus documentos avulsos"
  on public.painel_documentos_avulsos
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_documentos_avulsos to authenticated;

-- =====================================================================
-- STORAGE: bucket privado pra contratos e documentos pessoais.
-- Privado (public = false) porque são PDFs/fotos de CPF, CNPJ, RG, CNH —
-- o painel gera um link assinado (createSignedUrl) na hora de exibir/baixar.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documentos-juridicos', 'documentos-juridicos', false)
on conflict (id) do nothing;

drop policy if exists "Usuaria autenticada le documentos-juridicos" on storage.objects;
create policy "Usuaria autenticada le documentos-juridicos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos-juridicos');

drop policy if exists "Usuaria autenticada envia pra documentos-juridicos" on storage.objects;
create policy "Usuaria autenticada envia pra documentos-juridicos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos-juridicos');

drop policy if exists "Usuaria autenticada substitui em documentos-juridicos" on storage.objects;
create policy "Usuaria autenticada substitui em documentos-juridicos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documentos-juridicos');

drop policy if exists "Usuaria autenticada remove de documentos-juridicos" on storage.objects;
create policy "Usuaria autenticada remove de documentos-juridicos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documentos-juridicos');

-- =====================================================================
-- ABORDAGEM: motivo do arquivamento
-- Toda abordagem arquivada (manual ou automaticamente) guarda por quê.
-- arquivado_automaticamente diferencia as duas origens na aba Arquivados —
-- o arquivamento automático (virada de mês, ver arquivarAbordagensMesAnterior
-- no painel.html) sempre usa motivo 'prazo_expirado'.
-- =====================================================================
alter table public.painel_abordagens add column if not exists motivo_arquivamento text
  check (motivo_arquivamento in ('recusou', 'sem_retorno', 'banco_fechado', 'prazo_expirado'));

-- =====================================================================
-- PORTAL DO GUSTAVO (edilainesantos.com/gustavo)
-- Página separada, com login próprio, onde ele acompanha os gastos que são
-- dele (GU) ou conjuntos (DI/GU) e cuida da Pensão da Lívia. Antes de rodar
-- este bloco, crie o login dele em Authentication > Users > Add user, com:
--   email: gustavoamoreira@portal.edilainesantos.com
--   senha: (a que a Edilaine combinou com ele)
-- Esse e-mail é só uma chave técnica interna — ele nunca vê nem digita um
-- e-mail, só o código de acesso, na tela de login da página dele.
-- =====================================================================

-- Pensão da Lívia: um registro por mês (vencimento e valor editáveis pelo
-- Gustavo, "pago" vira true quando ele marca o botão "Paguei"). vencimento é
-- uma data completa (não só o dia) pra dar pra mudar de mês pra mês se precisar.
create table if not exists public.portal_gustavo_pensao (
  ano int not null,
  mes int not null,
  vencimento date not null,
  valor numeric,
  pago boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (ano, mes)
);

alter table public.portal_gustavo_pensao enable row level security;

drop policy if exists "Autenticados leem a pensao da Livia" on public.portal_gustavo_pensao;
create policy "Autenticados leem a pensao da Livia"
  on public.portal_gustavo_pensao
  for select
  to authenticated
  using (true);

drop policy if exists "Autenticados gerenciam a pensao da Livia" on public.portal_gustavo_pensao;
create policy "Autenticados gerenciam a pensao da Livia"
  on public.portal_gustavo_pensao
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on public.portal_gustavo_pensao to authenticated;

-- Pix que o Gustavo registra pra abater do que ele deve. Só ele lança (a
-- página não tem edição, só registrar novo ou remover um lançado por engano)
create table if not exists public.portal_gustavo_pix (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  valor numeric not null,
  created_at timestamptz not null default now()
);

alter table public.portal_gustavo_pix enable row level security;

drop policy if exists "Autenticados leem os pix do Gustavo" on public.portal_gustavo_pix;
create policy "Autenticados leem os pix do Gustavo"
  on public.portal_gustavo_pix
  for select
  to authenticated
  using (true);

drop policy if exists "Autenticados registram pix do Gustavo" on public.portal_gustavo_pix;
create policy "Autenticados registram pix do Gustavo"
  on public.portal_gustavo_pix
  for insert
  to authenticated
  with check (true);

drop policy if exists "Autenticados removem pix do Gustavo" on public.portal_gustavo_pix;
create policy "Autenticados removem pix do Gustavo"
  on public.portal_gustavo_pix
  for delete
  to authenticated
  using (true);

grant select, insert, delete on public.portal_gustavo_pix to authenticated;

-- =====================================================================
-- CORREÇÃO IMPORTANTE: financas_lancamentos e financas_gastos_fixos foram
-- criadas direto pelo Table Editor do Supabase (nunca passaram por este
-- setup.sql), e o RLS delas nunca tinha sido ativado de fato — sem RLS
-- ativado, TODAS as policies (inclusive as "restrictive" abaixo) são
-- ignoradas pelo Postgres, e qualquer autenticado vê tudo sem filtro
-- nenhum. Isso é o que estava deixando os lançamentos "DI" (só seus)
-- vazarem pra tela do Gustavo. Ativa o RLS de verdade e recria a regra
-- básica (qualquer autenticada lê/edita) que sempre valeu na prática —
-- sem essa regra aqui, ativar o RLS bloquearia até você.
-- =====================================================================
alter table public.financas_lancamentos enable row level security;
alter table public.financas_gastos_fixos enable row level security;

drop policy if exists "Autenticados leem e gerenciam lancamentos" on public.financas_lancamentos;
create policy "Autenticados leem e gerenciam lancamentos"
  on public.financas_lancamentos
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Autenticados leem e gerenciam gastos fixos" on public.financas_gastos_fixos;
create policy "Autenticados leem e gerenciam gastos fixos"
  on public.financas_gastos_fixos
  for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- Trava de segurança de verdade (não é só esconder na tela): identifica a
-- conta do Gustavo pelo e-mail técnico dela, e usa policies "restrictive".
-- Diferente das policies normais (que se somam com OU), uma restrictive
-- sempre se soma com E a qualquer outra regra que já exista na tabela — ou
-- seja, ela só ADICIONA um freio, sem precisar tocar nas regras que a
-- Edilaine já tem hoje em financas_lancamentos/financas_gastos_fixos.
-- Resultado: mesmo que alguém tente ler essas tabelas direto (fora da tela),
-- logada como Gustavo só vem GU e DI/GU, e nenhuma escrita é aceita.
-- =====================================================================
create or replace function public.eh_conta_gustavo()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'gustavoamoreira@portal.edilainesantos.com';
$$;

drop policy if exists "Gustavo so ve GU e DI-GU em lancamentos" on public.financas_lancamentos;
create policy "Gustavo so ve GU e DI-GU em lancamentos"
  on public.financas_lancamentos
  as restrictive
  for select
  to authenticated
  using ( not public.eh_conta_gustavo() or pessoa in ('GU', 'DI/GU') );

drop policy if exists "Gustavo nao insere em lancamentos" on public.financas_lancamentos;
create policy "Gustavo nao insere em lancamentos"
  on public.financas_lancamentos
  as restrictive
  for insert
  to authenticated
  with check ( not public.eh_conta_gustavo() );

drop policy if exists "Gustavo nao atualiza lancamentos" on public.financas_lancamentos;
create policy "Gustavo nao atualiza lancamentos"
  on public.financas_lancamentos
  as restrictive
  for update
  to authenticated
  using ( not public.eh_conta_gustavo() )
  with check ( not public.eh_conta_gustavo() );

drop policy if exists "Gustavo nao exclui lancamentos" on public.financas_lancamentos;
create policy "Gustavo nao exclui lancamentos"
  on public.financas_lancamentos
  as restrictive
  for delete
  to authenticated
  using ( not public.eh_conta_gustavo() );

drop policy if exists "Gustavo so ve GU e DI-GU em gastos fixos" on public.financas_gastos_fixos;
create policy "Gustavo so ve GU e DI-GU em gastos fixos"
  on public.financas_gastos_fixos
  as restrictive
  for select
  to authenticated
  using ( not public.eh_conta_gustavo() or pessoa in ('GU', 'DI/GU') );

drop policy if exists "Gustavo nao insere em gastos fixos" on public.financas_gastos_fixos;
create policy "Gustavo nao insere em gastos fixos"
  on public.financas_gastos_fixos
  as restrictive
  for insert
  to authenticated
  with check ( not public.eh_conta_gustavo() );

drop policy if exists "Gustavo nao atualiza gastos fixos" on public.financas_gastos_fixos;
create policy "Gustavo nao atualiza gastos fixos"
  on public.financas_gastos_fixos
  as restrictive
  for update
  to authenticated
  using ( not public.eh_conta_gustavo() )
  with check ( not public.eh_conta_gustavo() );

drop policy if exists "Gustavo nao exclui gastos fixos" on public.financas_gastos_fixos;
create policy "Gustavo nao exclui gastos fixos"
  on public.financas_gastos_fixos
  as restrictive
  for delete
  to authenticated
  using ( not public.eh_conta_gustavo() );

-- Habilita a réplica em tempo real: qualquer alteração feita no painel
-- principal (novo lançamento, pagar uma conta, etc.) chega sozinha na tela
-- do Gustavo, sem ele precisar atualizar a página.
alter publication supabase_realtime add table
  public.financas_lancamentos,
  public.financas_gastos_fixos,
  public.portal_gustavo_pensao,
  public.portal_gustavo_pix;

alter table public.painel_abordagens add column if not exists arquivado_automaticamente boolean not null default false;
