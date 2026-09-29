-- Histórico de anotações datadas por Cliente (aba Clientes) — cada anotação é uma linha
-- própria (não um campo único que se sobrescreve), pra dar pra ver a linha do tempo de
-- contatos/campanhas com aquela marca.
create table if not exists public.painel_clientes_notas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.painel_clientes(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_clientes_notas_cliente on public.painel_clientes_notas (cliente_id);

alter table public.painel_clientes_notas enable row level security;

drop policy if exists "Usuaria autenticada gerencia notas de clientes" on public.painel_clientes_notas;
create policy "Usuaria autenticada gerencia notas de clientes"
  on public.painel_clientes_notas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_clientes_notas to authenticated;

NOTIFY pgrst, 'reload schema';
