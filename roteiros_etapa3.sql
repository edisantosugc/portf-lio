-- =====================================================================
-- ROTEIROS — ETAPA 3: link público de aprovação + comentários da marca
-- Cole este arquivo inteiro no SQL Editor do Supabase (aba nova) e clique em "Run".
-- =====================================================================

-- Tabela de comentários gerais que a marca deixa na página pública.
create table if not exists public.painel_roteiros_comentarios (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references public.painel_roteiros(id) on delete cascade,
  autor text,
  mensagem text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_roteiros_comentarios_roteiro on public.painel_roteiros_comentarios (roteiro_id);

alter table public.painel_roteiros_comentarios enable row level security;

drop policy if exists "Usuaria autenticada ve comentarios dos roteiros" on public.painel_roteiros_comentarios;
create policy "Usuaria autenticada ve comentarios dos roteiros"
  on public.painel_roteiros_comentarios
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_roteiros_comentarios to authenticated;

-- A marca NUNCA acessa a tabela painel_roteiros nem a de comentários direto — ela só
-- acessa através destas 3 funções abaixo (SECURITY DEFINER), que enxergam só o
-- necessário e exigem sempre o token secreto do link. Assim, mesmo que alguém tente
-- consultar a tabela sem o token, não acha nada (nenhuma policy libera anon nela).

-- 1) Busca os dados do roteiro pelo token e marca como visualizado na primeira vez.
create or replace function public.obter_roteiro_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roteiro public.painel_roteiros;
begin
  select * into v_roteiro from public.painel_roteiros where link_token = p_token;
  if not found then
    return null;
  end if;

  if v_roteiro.visualizado_em is null then
    update public.painel_roteiros set visualizado_em = now() where id = v_roteiro.id;
    v_roteiro.visualizado_em := now();
  end if;

  return jsonb_build_object(
    'marca', v_roteiro.marca,
    'produto', v_roteiro.produto,
    'categoria', v_roteiro.categoria,
    'duracao_prevista', v_roteiro.duracao_prevista,
    'personalizar_cor', v_roteiro.personalizar_cor,
    'cor_marca', v_roteiro.cor_marca,
    'roteiro_html', v_roteiro.roteiro_html,
    'cenas', v_roteiro.cenas,
    'moodboard', v_roteiro.moodboard
  );
end;
$$;

-- 2) Salva a observação que a marca escreveu numa cena específica (por índice).
create or replace function public.salvar_observacao_cena_publico(p_token text, p_indice int, p_observacao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.painel_roteiros where link_token = p_token;
  if v_id is null then
    raise exception 'Link inválido.';
  end if;

  update public.painel_roteiros
  set cenas = jsonb_set(cenas, array[p_indice::text, 'observacao'], to_jsonb(coalesce(p_observacao, '')))
  where id = v_id;
end;
$$;

-- 3) Registra um comentário geral da marca sobre o roteiro.
create or replace function public.enviar_comentario_roteiro_publico(p_token text, p_autor text, p_mensagem text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_mensagem is null or trim(p_mensagem) = '' then
    raise exception 'Comentário vazio.';
  end if;
  select id into v_id from public.painel_roteiros where link_token = p_token;
  if v_id is null then
    raise exception 'Link inválido.';
  end if;

  insert into public.painel_roteiros_comentarios (roteiro_id, autor, mensagem)
  values (v_id, nullif(trim(p_autor), ''), trim(p_mensagem));
end;
$$;

revoke all on function public.obter_roteiro_publico(text) from public;
revoke all on function public.salvar_observacao_cena_publico(text, int, text) from public;
revoke all on function public.enviar_comentario_roteiro_publico(text, text, text) from public;

grant execute on function public.obter_roteiro_publico(text) to anon;
grant execute on function public.salvar_observacao_cena_publico(text, int, text) to anon;
grant execute on function public.enviar_comentario_roteiro_publico(text, text, text) to anon;

NOTIFY pgrst, 'reload schema';
