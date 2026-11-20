-- =====================================================================
-- SEGURANÇA (parte 2): login da DEMONSTRAÇÃO + avisos do Portal e do Conector
--
-- 1. Demo (edilainesantos.com/demo) passa a exigir login próprio:
--    - demo_acesso: o e-mail e a senha (só o "hash", nunca a senha em si)
--      do login da demo. A senha é definida à parte, direto no SQL Editor,
--      e NUNCA fica escrita em arquivo do site.
--    - entrar_demo(): confere e-mail/senha no servidor e devolve um passe
--      que vale 12 horas. Errou: registra em Segurança e avisa no celular.
--      Trava: 5 senhas erradas em 15 minutos bloqueiam a demo por 15 minutos.
--    - validar_demo(): as páginas da demo conferem o passe antes de abrir.
--    - Esse login NÃO é uma conta do painel: não dá acesso a nenhum dado real.
-- 2. registrar_tentativa_acesso passa a aceitar também:
--    'portal' (código errado no Portal do Gustavo), 'conector' (senha errada
--    na página de conectar o Claude) e 'demo' (login errado na demonstração).
-- Não apaga nem altera nenhum dado existente. Pode rodar mais de uma vez.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tipos novos de tentativa ----------
alter table public.seguranca_tentativas drop constraint if exists seguranca_tentativas_tipo_check;
alter table public.seguranca_tentativas add constraint seguranca_tentativas_tipo_check
  check (tipo in ('login', 'recuperar', 'portal', 'conector', 'demo'));

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
  v_quem_txt text;
  v_hora text := to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI');
  segredo text;
begin
  if p_tipo not in ('login', 'recuperar', 'portal', 'conector', 'demo') then return; end if;
  if p_tipo = 'portal' then v_email := ''; end if;   -- portal usa só código, não tem e-mail
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

  v_quem_txt := coalesce(nullif(v_email, ''), 'Alguém');
  if v_n = 1 then
    if p_tipo = 'portal' then
      v_titulo := '⚠️ Código errado no Portal do Gustavo';
      v_corpo := 'Alguém digitou um código errado no Portal às ' || v_hora || coalesce('. ' || v_aparelho, '') || '.';
    elsif p_tipo = 'demo' then
      v_titulo := '⚠️ Tentativa de acesso à demonstração';
      v_corpo := v_quem_txt || ' tentou entrar na demo às ' || v_hora || ' (login errado)' || coalesce('. ' || v_aparelho, '') || '.';
    elsif p_tipo = 'conector' then
      v_titulo := '⚠️ Tentativa de conectar ao seu painel';
      v_corpo := v_quem_txt || ' errou a senha na página de conectar o Claude às ' || v_hora || coalesce('. ' || v_aparelho, '') || '.';
    elsif v_quem = 'voce' then
      v_titulo := '🔑 Senha errada no seu e-mail';
      v_corpo := 'Alguém (provavelmente você) errou a senha do seu e-mail às ' || v_hora || coalesce('. ' || v_aparelho, '') || '.';
    elsif p_tipo = 'recuperar' then
      v_titulo := '⚠️ Pedido de recuperação de senha';
      v_corpo := v_quem_txt || ' pediu link de recuperação às ' || v_hora || ' (sem acesso, nada foi enviado)' || coalesce('. ' || v_aparelho, '') || '.';
    else
      v_titulo := '⚠️ Tentativa de acesso ao painel';
      v_corpo := v_quem_txt || ' tentou entrar às ' || v_hora || ' (senha errada)' || coalesce('. ' || v_aparelho, '') || '.';
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

-- ---------- Login da demonstração ----------
create table if not exists public.demo_acesso (
  id boolean primary key default true check (id),
  email text not null,
  senha_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.demo_sessoes (
  token text primary key,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
-- Ninguém lê nem mexe direto nessas tabelas (nem logado): só pelas funções abaixo.
alter table public.demo_acesso enable row level security;
alter table public.demo_sessoes enable row level security;
revoke all on public.demo_acesso, public.demo_sessoes from anon, authenticated;

create or replace function public.entrar_demo(p_email text, p_senha text, p_aparelho text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ok boolean;
  v_token text;
  v_erros integer;
begin
  -- Trava: 5 senhas erradas em 15 minutos bloqueiam a demo por 15 minutos (até pra senha certa)
  select count(*) into v_erros from public.seguranca_tentativas
    where tipo = 'demo' and created_at > now() - interval '15 minutes';
  if v_erros >= 5 then return 'bloqueado'; end if;

  select exists (
    select 1 from public.demo_acesso
    where id = true
      and email = lower(trim(coalesce(p_email, '')))
      and senha_hash = crypt(coalesce(p_senha, ''), senha_hash)
  ) into v_ok;

  if not v_ok then
    perform public.registrar_tentativa_acesso(p_email, 'demo', p_aparelho);
    return null;
  end if;

  delete from public.demo_sessoes where expira_em < now();
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.demo_sessoes (token, expira_em) values (v_token, now() + interval '12 hours');
  return v_token;
end;
$$;

create or replace function public.validar_demo(p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.demo_sessoes where token = coalesce(p_token, '') and expira_em > now());
$$;

revoke all on function public.entrar_demo(text, text, text) from public;
revoke all on function public.validar_demo(text) from public;
grant execute on function public.entrar_demo(text, text, text) to anon, authenticated;
grant execute on function public.validar_demo(text) to anon, authenticated;

-- Conferência: deve mostrar 2 linhas (entrar_demo e validar_demo)
select proname from pg_proc where proname in ('entrar_demo', 'validar_demo') order by proname;
