-- =====================================================================
-- DISPARO DE E-MAILS (aba "Prospecção" do painel)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo no futuro sem problema (todos os comandos são seguros
-- de repetir: "se não existir", "apaga e recria a regra").
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Seleção de marcas na aba Marcas: fica salva no banco (não some
--    quando você fecha o admin ou troca de aparelho).
-- ---------------------------------------------------------------------
alter table public.painel_marcas add column if not exists selecionada boolean not null default false;

-- ---------------------------------------------------------------------
-- 2) email_envios: uma linha por destinatário, sempre que um e-mail é
--    mandado pela função "enviar-emails". Sem isso, se um disparo parar
--    no meio, não tem como saber quem recebeu e quem não recebeu.
-- ---------------------------------------------------------------------
create table if not exists public.email_envios (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  assunto text not null,
  status text not null check (status in ('ok', 'erro')),
  erro text,                    -- mensagem de erro, só preenchido quando status = 'erro'
  resend_id text,                -- id que o Resend devolve, útil pra rastrear o envio lá
  created_at timestamptz not null default now()
);

create index if not exists idx_email_envios_email on public.email_envios (email);
create index if not exists idx_email_envios_assunto on public.email_envios (assunto);

alter table public.email_envios enable row level security;

drop policy if exists "Usuaria autenticada gerencia email_envios" on public.email_envios;
create policy "Usuaria autenticada gerencia email_envios"
  on public.email_envios
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.email_envios to authenticated;

-- ---------------------------------------------------------------------
-- 3) email_optout: quem respondeu SAIR (ou pediu pra não receber mais).
--    A função "enviar-emails" sempre confere esta tabela antes de mandar
--    qualquer e-mail, e nunca manda pra quem estiver aqui.
-- ---------------------------------------------------------------------
create table if not exists public.email_optout (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_optout_email on public.email_optout (email);

alter table public.email_optout enable row level security;

drop policy if exists "Usuaria autenticada gerencia email_optout" on public.email_optout;
create policy "Usuaria autenticada gerencia email_optout"
  on public.email_optout
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.email_optout to authenticated;

-- ---------------------------------------------------------------------
-- 4) Liga Prospecção com Abordagens: todo e-mail enviado de verdade cria
--    (ou atualiza) sozinho uma linha na aba Abordagens, sem cadastro manual.
--    marca_origem_id é o que faz a ligação — sem ele, o painel teria que
--    adivinhar por nome, o que quebra se duas marcas tiverem nomes parecidos.
-- ---------------------------------------------------------------------
alter table public.painel_abordagens add column if not exists marca_origem_id uuid references public.painel_marcas(id) on delete set null;
create index if not exists idx_painel_abordagens_marca_origem on public.painel_abordagens (marca_origem_id);

-- Novo status "follow_up": usado quando a Prospecção manda um segundo e-mail (ou mais)
-- pra uma marca que já tinha sido abordada — atualiza a mesma linha em vez de duplicar.
alter table public.painel_abordagens drop constraint if exists painel_abordagens_status_check;
alter table public.painel_abordagens add constraint painel_abordagens_status_check
  check (status in ('rascunho', 'realizada', 'follow_up', 'andamento', 'fechada', 'sem_retorno'));

-- ---------------------------------------------------------------------
-- 5) email_envios ganha o HTML de verdade que foi mandado pra cada
--    destinatário — sem isso não tem como reabrir depois e ver o que
--    a marca recebeu (card "Já receberam" no painel).
-- ---------------------------------------------------------------------
alter table public.email_envios add column if not exists corpo_html text;

-- Atualiza o cache do Supabase pra reconhecer as tabelas/colunas novas na hora
-- (sem isso, às vezes ele demora e o painel mostra "tabela não encontrada").
NOTIFY pgrst, 'reload schema';
