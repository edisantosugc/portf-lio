-- =====================================================================
-- CRONOGRAMA DE CONTEÚDOS (aba Instagram > "Cronograma de Conteúdos")
-- Só CRIA uma tabela nova. Não mexe em nenhuma tabela existente.
-- Mesma trava da aba Assistente: só a dona, visitantes nada, ninguém apaga.
-- O nome começa com "assistente_" de propósito: o conector do Claude só
-- enxerga tabelas assistente_*.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

create table if not exists public.assistente_cronograma (
  id uuid primary key default gen_random_uuid(),

  -- Em qual lista está (calculado sozinho pelo status: "Postado" = Postados)
  lista text not null default 'Grade' check (lista in ('Grade','Postados')),
  -- Posição na Grade (a ordem que a Edi deixa; menor = mais em cima)
  posicao double precision not null,

  -- Colunas da planilha
  dia text not null default 'A definir'
    check (dia in ('Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo','Extra','Stories','A definir')),
  tema text check (char_length(tema) <= 500),
  ideia text check (char_length(ideia) <= 5000),
  formato text check (char_length(formato) <= 500),
  status text not null default 'Sugestão (aprovar)'
    check (status in ('Sugestão (aprovar)','Ideia aprovada','Roteiro pronto','A gravar','Em produção',
                      'Gravado (falta editar)','Em teste','Postado','A confirmar','Descartado')),
  observacoes text check (char_length(observacoes) <= 500000),

  -- Postagem e métricas (preenchidas 48h depois de postar)
  data_postagem date,
  visualizacoes integer check (visualizacoes >= 0),
  alcance integer check (alcance >= 0),
  nao_seguidores_pct numeric(5,2) check (nao_seguidores_pct between 0 and 100),
  tempo_medio_seg numeric(8,2) check (tempo_medio_seg >= 0),
  taxa_pulo_pct numeric(5,2) check (taxa_pulo_pct between 0 and 100),
  curtidas integer check (curtidas >= 0),
  comentarios integer check (comentarios >= 0),
  compartilhamentos integer check (compartilhamentos >= 0),
  salvamentos integer check (salvamentos >= 0),
  seguidores_ganhos integer check (seguidores_ganhos >= 0),
  anotacao_metricas text check (char_length(anotacao_metricas) <= 20000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistente_cronograma_ordem on public.assistente_cronograma (lista, posicao);

-- ---------- Regras automáticas (valem pro painel E pro conector) ----------
-- 1) Status "Postado" => vai pra Postados (data de hoje se não vier data).
-- 2) Sai do "Postado" => volta pra Grade, no fim do bloco do dia dela.
-- 3) Ideia nova sem posição => entra no fim do bloco do dia dela.
-- 4) Fora isso, a posição nunca muda sozinha.
create or replace function public.assistente_cronograma_regras()
returns trigger
language plpgsql
as $$
declare
  ultima_do_dia double precision;
  seguinte double precision;
  maior double precision;
  precisa_posicao boolean := false;
begin
  new.lista := case when new.status = 'Postado' then 'Postados' else 'Grade' end;

  if new.lista = 'Postados' and new.data_postagem is null then
    new.data_postagem := (now() at time zone 'America/Sao_Paulo')::date;
  end if;

  if tg_op = 'INSERT' then
    precisa_posicao := new.posicao is null;
  else
    precisa_posicao := (old.lista = 'Postados' and new.lista = 'Grade');
    new.updated_at := now();
  end if;

  if precisa_posicao then
    select max(posicao) into ultima_do_dia from public.assistente_cronograma
      where lista = 'Grade' and dia = new.dia and id <> new.id;
    if ultima_do_dia is not null then
      select min(posicao) into seguinte from public.assistente_cronograma
        where lista = 'Grade' and posicao > ultima_do_dia and id <> new.id;
      new.posicao := case when seguinte is null then ultima_do_dia + 1 else (ultima_do_dia + seguinte) / 2 end;
    else
      select max(posicao) into maior from public.assistente_cronograma where lista = 'Grade' and id <> new.id;
      new.posicao := coalesce(maior, 0) + 1;
    end if;
  elsif new.posicao is null then
    new.posicao := coalesce(old.posicao, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists assistente_cronograma_regras on public.assistente_cronograma;
create trigger assistente_cronograma_regras before insert or update on public.assistente_cronograma
  for each row execute function public.assistente_cronograma_regras();

-- ---------- Segurança (RLS) ----------
alter table public.assistente_cronograma enable row level security;

revoke all on public.assistente_cronograma from anon;
revoke delete on public.assistente_cronograma from authenticated, service_role;

drop policy if exists "Dona le cronograma" on public.assistente_cronograma;
create policy "Dona le cronograma" on public.assistente_cronograma
  for select to authenticated using (public.assistente_eh_dona());
drop policy if exists "Dona cria cronograma" on public.assistente_cronograma;
create policy "Dona cria cronograma" on public.assistente_cronograma
  for insert to authenticated with check (public.assistente_eh_dona());
drop policy if exists "Dona atualiza cronograma" on public.assistente_cronograma;
create policy "Dona atualiza cronograma" on public.assistente_cronograma
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

-- Conferência
select count(*) as colunas_criadas from information_schema.columns
where table_schema = 'public' and table_name = 'assistente_cronograma';
