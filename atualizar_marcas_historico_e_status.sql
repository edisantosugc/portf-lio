-- 1) Histórico de atualizações datadas por Marca (aba Marcas) — mesmo modelo do histórico
--    de Clientes e de Abordagens.
create table if not exists public.painel_marcas_notas (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.painel_marcas(id) on delete cascade,
  texto text not null,
  data date not null default current_date, -- data da atualização (editável), não a data de cadastro
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_marcas_notas_marca on public.painel_marcas_notas (marca_id);

alter table public.painel_marcas_notas enable row level security;

drop policy if exists "Usuaria autenticada gerencia notas de marcas" on public.painel_marcas_notas;
create policy "Usuaria autenticada gerencia notas de marcas"
  on public.painel_marcas_notas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_marcas_notas to authenticated;

-- 2) Status sincronizados entre as abas: "Respondeu" em Abordagens e "Em negociação"
--    ('andamento') em Marcas.
alter table public.painel_abordagens drop constraint if exists painel_abordagens_status_check;
alter table public.painel_abordagens add constraint painel_abordagens_status_check
  check (status in ('rascunho', 'realizada', 'follow_up', 'respondeu', 'andamento', 'contato_futuro', 'fechada', 'sem_retorno'));

alter table public.painel_marcas drop constraint if exists painel_marcas_status_check;
alter table public.painel_marcas add constraint painel_marcas_status_check
  check (status in ('a_enviar', 'enviado', 'follow_up', 'respondeu', 'contato_futuro', 'proposta', 'andamento', 'fechado', 'sem_interesse'));

NOTIFY pgrst, 'reload schema';
