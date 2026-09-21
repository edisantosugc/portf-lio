-- =====================================================================
-- ROTEIROS — ETAPA 4: botões de Aprovar/Ajustar no link público + aviso
-- automático (mensagem no painel + push celular + push no painel + e-mail).
-- Cole este arquivo inteiro no SQL Editor do Supabase (aba nova) e clique em "Run".
--
-- Antes de rodar, publique a Edge Function nova (supabase/functions/send-roteiro-email)
-- pelo dashboard, igual você já fez com as outras — ela usa os MESMOS segredos que já
-- estão configurados (SCHED_SECRET, RESEND_API_KEY, BRIEFING_EMAIL_DESTINO opcional).
-- =====================================================================

-- Cada clique em "Aprovar" ou "Ajustar condições solicitadas" no link público vira
-- uma linha aqui — é o que alimenta a nova aba "Aprovação de Roteiro" em Mensagens.
create table if not exists public.painel_roteiros_respostas (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references public.painel_roteiros(id) on delete cascade,
  marca text not null,
  tipo text not null check (tipo in ('aprovado', 'ajustes')),
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_roteiros_respostas_roteiro on public.painel_roteiros_respostas (roteiro_id);
create index if not exists idx_roteiros_respostas_created_at on public.painel_roteiros_respostas (created_at desc);

alter table public.painel_roteiros_respostas enable row level security;

drop policy if exists "Usuaria autenticada ve respostas dos roteiros" on public.painel_roteiros_respostas;
create policy "Usuaria autenticada ve respostas dos roteiros"
  on public.painel_roteiros_respostas
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_roteiros_respostas to authenticated;

-- Chamada pelos botões "Aprovar"/"Ajustar condições solicitadas" no roteiro.html —
-- muda o status do roteiro e registra a resposta (o gatilho abaixo faz o aviso).
create or replace function public.responder_roteiro_publico(p_token text, p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roteiro public.painel_roteiros;
  v_novo_status text;
begin
  if p_tipo not in ('aprovado', 'ajustes') then
    raise exception 'Tipo de resposta inválido.';
  end if;

  select * into v_roteiro from public.painel_roteiros where link_token = p_token;
  if not found then
    raise exception 'Link inválido.';
  end if;

  v_novo_status := case p_tipo when 'aprovado' then 'aprovado' else 'aguardando_ajustes' end;
  update public.painel_roteiros set status = v_novo_status where id = v_roteiro.id;

  insert into public.painel_roteiros_respostas (roteiro_id, marca, tipo)
  values (v_roteiro.id, v_roteiro.marca, p_tipo);
end;
$$;

revoke all on function public.responder_roteiro_publico(text, text) from public;
grant execute on function public.responder_roteiro_publico(text, text) to anon;

-- Avisa a Edi por push (celular + navegador) E por e-mail assim que a marca aprova ou
-- pede ajuste — mesmo padrão já usado em trigger_notificar_novo_briefing.
create or replace function public.notificar_resposta_roteiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
  aprovado boolean;
begin
  select valor into segredo from public.app_config where nome = 'sched_secret';
  aprovado := new.tipo = 'aprovado';

  perform net.http_post(
    url := 'https://dqtoxxngjqyoibdgmrjr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'x-sched-key', segredo,
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc'
    ),
    body := jsonb_build_object(
      'conta', 'di',
      'titulo', case when aprovado then new.marca || ' aprovou o roteiro' else new.marca || ' pediu ajuste no roteiro' end,
      'corpo', case when aprovado then 'Pode seguir pra gravação.' else 'Confira as condições solicitadas no painel.' end,
      'url', '/painel.html'
    )
  );

  perform net.http_post(
    url := 'https://dqtoxxngjqyoibdgmrjr.supabase.co/functions/v1/send-roteiro-email',
    headers := jsonb_build_object(
      'x-sched-key', segredo,
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc'
    ),
    body := jsonb_build_object(
      'marca', new.marca,
      'tipo', new.tipo
    )
  );

  return new;
end;
$$;

drop trigger if exists trigger_notificar_resposta_roteiro on public.painel_roteiros_respostas;
create trigger trigger_notificar_resposta_roteiro
  after insert on public.painel_roteiros_respostas
  for each row
  execute function public.notificar_resposta_roteiro();

NOTIFY pgrst, 'reload schema';
