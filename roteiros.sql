-- =====================================================================
-- ROTEIROS PARA APROVAÇÃO (aba "Roteiros", dentro da gaveta de Clientes)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Etapa 1: formulário + lista salvando de verdade. As colunas de cenas,
-- moodboard e link público já ficam prontas aqui, mas a conversão do Excel,
-- a página pública e o moodboard arrastável são as próximas etapas.
-- =====================================================================
create table if not exists public.painel_roteiros (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aguardando_ajustes', 'aprovado')),
  visualizado_em timestamptz,                 -- preenchido sozinho quando a marca abre o link público (etapa 3)
  personalizar_cor boolean not null default false,
  cor_marca text,                             -- hex escolhido manualmente
  paleta_marca jsonb,                         -- array de hex identificados a partir da imagem (etapa 4)
  imagem_referencia_url text,                 -- imagem enviada pra identificar a paleta
  produto text,
  trabalho_id uuid references public.painel_ugc_trabalhos(id) on delete set null,
  duracao_prevista text,
  categoria text,
  roteiro_html text,                          -- texto do editor rico (quando escrito direto, não por Excel)
  cenas jsonb not null default '[]'::jsonb,    -- [{numero, tag_etapa, tempo, narracao, descricao_cena, observacao}]
  moodboard jsonb not null default '[]'::jsonb,-- [{url, x, y, rotacao}] (etapa 5)
  link_token text unique default replace(gen_random_uuid()::text, '-', ''), -- identifica o link público (etapa 3)
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_roteiros_status on public.painel_roteiros (status);
create index if not exists idx_painel_roteiros_link_token on public.painel_roteiros (link_token);

alter table public.painel_roteiros enable row level security;

drop policy if exists "Usuaria autenticada gerencia seus roteiros" on public.painel_roteiros;
create policy "Usuaria autenticada gerencia seus roteiros"
  on public.painel_roteiros
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_roteiros to authenticated;

-- Espaço pra guardar a imagem de referência de cor e as fotos do moodboard.
-- Bucket público (só imagem, sem dado sensível), mas só quem tem a chave do
-- site consegue enviar arquivo novo pra dentro dele.
insert into storage.buckets (id, name, public)
values ('roteiros-midia', 'roteiros-midia', true)
on conflict (id) do nothing;

drop policy if exists "Usuaria autenticada envia midia de roteiros" on storage.objects;
create policy "Usuaria autenticada envia midia de roteiros"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'roteiros-midia');

drop policy if exists "Usuaria autenticada remove midia de roteiros" on storage.objects;
create policy "Usuaria autenticada remove midia de roteiros"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'roteiros-midia');

NOTIFY pgrst, 'reload schema';
