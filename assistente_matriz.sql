-- =====================================================================
-- ABA ASSISTENTE > PENDÊNCIAS EM MATRIZ (Eisenhower)
-- Só ACRESCENTA. Não apaga nem altera nenhuma pendência existente:
-- as que já existem ficam com quadrante vazio ("Sem quadrante").
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- 1) Campo novo: quadrante (vazio por padrão; só aceita as 4 opções)
alter table public.assistente_pendencias
  add column if not exists quadrante text;

alter table public.assistente_pendencias
  drop constraint if exists assistente_pendencias_quadrante_check;
alter table public.assistente_pendencias
  add constraint assistente_pendencias_quadrante_check
  check (quadrante is null or quadrante in ('Faça na hora','Programe-se','Delegue','Tempo livre ou elimine'));

-- 2) Campo novo: data agendada (opcional)
alter table public.assistente_pendencias
  add column if not exists data_agendada date;

-- 3) Status: passa a aceitar também "Descartado"
--    (só troca a regra do que é aceito; nenhuma pendência é mexida)
do $$
declare
  regra record;
begin
  for regra in
    select conname from pg_constraint
    where conrelid = 'public.assistente_pendencias'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.assistente_pendencias drop constraint %I', regra.conname);
  end loop;
end $$;

alter table public.assistente_pendencias
  add constraint assistente_pendencias_status_check
  check (status in ('Pendente','Em andamento','Feito','Descartado'));

-- 4) Conferência: mostra as colunas novas e as regras atuais
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'assistente_pendencias'
  and column_name in ('quadrante','data_agendada','status');
