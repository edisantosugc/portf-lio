-- =====================================================================
-- SEGURANÇA: aviso quando alguém tenta acessar o painel
-- (Administrativo > Segurança)
--
-- - A página de login chama registrar_tentativa_acesso() quando:
--     * alguém erra o login (e-mail ou senha errados), ou
--     * alguém pede link de recuperação com um e-mail que não é o da dona.
-- - A função guarda a tentativa e manda notificação no celular da dona
--   (pelo mesmo send-push de sempre, com o segredo de app_config).
-- - Proteção contra excesso: dentro de 10 minutos só notifica na 1ª, 3ª,
--   10ª, 30ª e 100ª tentativa (as seguintes viram aviso agrupado), no
--   máximo 20 notificações por dia, e para de registrar depois de 300
--   tentativas em 10 minutos (ninguém consegue encher o banco).
-- - Só a dona lê o histórico e liga/desliga os avisos. Ninguém de fora
--   consegue ler, editar ou apagar nada (só registrar, pela função).
-- Não apaga nem altera nenhum dado existente. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.seguranca_tentativas (
  id uuid primary key default gen_random_uuid(),
  email text check (char_length(email) <= 254),
  tipo text not null check (tipo in ('login', 'recuperar')),
  quem text not null check (quem in ('fora', 'voce')),
  aparelho text check (char_length(aparelho) <= 120),
  avisado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists seguranca_tentativas_data on public.seguranca_tentativas (created_at desc);

create table if not exists public.seguranca_config (
  id boolean primary key default true check (id),
  avisos_ligados boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.seguranca_config (id) values (true) on conflict (id) do nothing;

-- ---------- Segurança (RLS) ----------
alter table public.seguranca_tentativas enable row level security;
alter table public.seguranca_config enable row level security;
revoke all on public.seguranca_tentativas, public.seguranca_config from anon;
revoke all on public.seguranca_tentativas, public.seguranca_config from authenticated;
grant select on public.seguranca_tentativas to authenticated;
grant select, update on public.seguranca_config to authenticated;

drop policy if exists "Dona le tentativas" on public.seguranca_tentativas;
create policy "Dona le tentativas" on public.seguranca_tentativas
  for select to authenticated using (public.assistente_eh_dona());

drop policy if exists "Dona le config seguranca" on public.seguranca_config;
create policy "Dona le config seguranca" on public.seguranca_config
  for select to authenticated using (public.assistente_eh_dona());

drop policy if exists "Dona muda config seguranca" on public.seguranca_config;
create policy "Dona muda config seguranca" on public.seguranca_config
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

-- ---------- Registrar tentativa + avisar ----------
create or replace function public.registrar_tentativa_acesso(p_email text, p_tipo text, p_aparelho text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := left(lower(trim(coalesce(p_email, ''))), 254);
  v_aparelho text := nullif(left(trim(coalesce(p_aparelho, '')), 120), '');
  v_quem text;
  v_recentes integer;
  v_n integer;
  v_emails integer;
  v_avisos_hoje integer;
  v_ligados boolean;
  v_id uuid;
  v_titulo text;
  v_corpo text;
  v_hora text := to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI');
  segredo text;
begin
  if p_tipo not in ('login', 'recuperar') then return; end if;
  v_quem := case when v_email = 'edilainesantosugc@gmail.com' then 'voce' else 'fora' end;

  select count(*) into v_recentes from public.seguranca_tentativas where created_at > now() - interval '10 minutes';
  if v_recentes >= 300 then return; end if;   -- trava contra quem tenta encher o banco

  insert into public.seguranca_tentativas (email, tipo, quem, aparelho)
  values (nullif(v_email, ''), p_tipo, v_quem, v_aparelho)
  returning id into v_id;

  select avisos_ligados into v_ligados from public.seguranca_config where id = true;
  if not coalesce(v_ligados, true) then return; end if;

  v_n := v_recentes + 1;
  if v_n not in (1, 3, 10, 30, 100) then return; end if;

  select count(*) into v_avisos_hoje from public.seguranca_tentativas where avisado and created_at > now() - interval '24 hours';
  if v_avisos_hoje >= 20 then return; end if;

  if v_n = 1 then
    if v_quem = 'voce' then
      v_titulo := '🔑 Senha errada no seu e-mail';
      v_corpo := 'Alguém (provavelmente você) errou a senha do seu e-mail às ' || v_hora || coalesce('. ' || v_aparelho, '') || '.';
    elsif p_tipo = 'recuperar' then
      v_titulo := '⚠️ Pedido de recuperação de senha';
      v_corpo := coalesce(nullif(v_email, ''), 'Alguém') || ' pediu link de recuperação às ' || v_hora || ' (sem acesso, nada foi enviado)' || coalesce('. ' || v_aparelho, '') || '.';
    else
      v_titulo := '⚠️ Tentativa de acesso ao painel';
      v_corpo := coalesce(nullif(v_email, ''), 'Alguém') || ' tentou entrar às ' || v_hora || ' (senha errada)' || coalesce('. ' || v_aparelho, '') || '.';
    end if;
  else
    select count(distinct coalesce(email, '')) into v_emails from public.seguranca_tentativas where created_at > now() - interval '10 minutes';
    v_titulo := '🚨 Muitas tentativas de acesso';
    v_corpo := v_n || ' tentativas nos últimos 10 minutos (' || v_emails || case when v_emails = 1 then ' e-mail' else ' e-mails diferentes' end || '). Veja a lista no painel.';
  end if;

  update public.seguranca_tentativas set avisado = true where id = v_id;

  select valor into segredo from public.app_config where nome = 'sched_secret';
  if segredo is null then return; end if;

  perform net.http_post(
    url := 'https://dqtoxxngjqyoibdgmrjr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'x-sched-key', segredo,
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc'
    ),
    body := jsonb_build_object('conta', 'di', 'titulo', v_titulo, 'corpo', v_corpo, 'url', '/painel.html?ir=seguranca')
  );
end;
$$;

revoke all on function public.registrar_tentativa_acesso(text, text, text) from public;
grant execute on function public.registrar_tentativa_acesso(text, text, text) to anon, authenticated;

-- Conferência: deve mostrar 1 linha com avisos_ligados = true
select avisos_ligados from public.seguranca_config;
