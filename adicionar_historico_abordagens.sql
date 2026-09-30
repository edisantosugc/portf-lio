-- Histórico de atualizações datadas por Abordagem (aba Abordagens) — cada atualização é uma
-- linha própria (não um campo único que se sobrescreve), mesmo modelo do histórico de Clientes.
create table if not exists public.painel_abordagens_notas (
  id uuid primary key default gen_random_uuid(),
  abordagem_id uuid not null references public.painel_abordagens(id) on delete cascade,
  texto text not null,
  data date not null default current_date, -- data da atualização (editável), não a data de cadastro
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_abordagens_notas_abordagem on public.painel_abordagens_notas (abordagem_id);

alter table public.painel_abordagens_notas enable row level security;

drop policy if exists "Usuaria autenticada gerencia notas de abordagens" on public.painel_abordagens_notas;
create policy "Usuaria autenticada gerencia notas de abordagens"
  on public.painel_abordagens_notas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_abordagens_notas to authenticated;

NOTIFY pgrst, 'reload schema';
