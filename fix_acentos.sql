-- =====================================================================
-- CORRECAO: tira acento do texto das notificacoes push (estava chegando
-- quebrado no celular) e conserta os nomes de categoria da aba Links que
-- ja foram salvos com o acento errado. Cole tudo e clique em "Run".
-- =====================================================================

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
      'corpo', case when aprovado then 'Pode seguir pra gravar.' else 'Confira o que a marca pediu no painel.' end,
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

-- Renomeia a categoria de Links que salvou com o acento quebrado, tanto na tabela de
-- categorias quanto em qualquer link que ja usa ela.
update public.painel_links_categorias set nome = 'Dominio' where nome like 'Dom%nio' and nome <> 'Dominio';
update public.painel_links set categoria = 'Dominio' where categoria like 'Dom%nio' and categoria <> 'Dominio';

update public.painel_links_categorias set nome = 'Meu App/Admin' where nome = 'Aplicativo/App Admin';
update public.painel_links set categoria = 'Meu App/Admin' where categoria = 'Aplicativo/App Admin';

NOTIFY pgrst, 'reload schema';
