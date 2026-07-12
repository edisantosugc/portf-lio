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

-- =====================================================================
-- IMPORTANTE:
-- De propósito, nenhuma policy de INSERT foi criada para o papel "anon"
-- (visitantes do site, não logados). A gravacao dos eventos (visitas,
-- cliques, videos assistidos) e das mensagens de contato deve ser feita
-- pelo SEU SERVIDOR (uma function/endpoint que usa a chave "service_role",
-- que nunca fica exposta no navegador) e nao diretamente pelo navegador
-- do visitante com a chave "anon". Isso evita que qualquer pessoa envie
-- eventos ou mensagens falsas direto pelo console do navegador dela.
-- =====================================================================
