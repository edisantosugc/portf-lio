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
  created_at timestamptz not null default now()
);

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
create policy "Usuarios autenticados podem ler eventos"
  on public.portfolio_events
  for select
  to authenticated
  using (true);

create policy "Usuarios autenticados podem ler leads"
  on public.portfolio_leads
  for select
  to authenticated
  using (true);

-- As policies acima controlam QUAIS LINHAS podem ser lidas, mas o Postgres
-- exige tambem uma permissao basica de acesso a tabela em si. Quando as
-- tabelas sao criadas pela interface do Supabase isso e feito automatico,
-- mas como criamos via SQL, precisamos liberar explicitamente:
grant usage on schema public to authenticated;
grant select on public.portfolio_events to authenticated;
grant select on public.portfolio_leads to authenticated;

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
create policy "Visitantes podem registrar eventos"
  on public.portfolio_events
  for insert
  to anon
  with check (true);

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

create policy "Usuaria autenticada gerencia suas tarefas"
  on public.painel_tarefas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_tarefas to authenticated;
