# Automação de DM do Instagram (Instagram > Automações)

Este documento é o passo a passo pra ligar de verdade o motor de automação de
comentários e mensagens diretas construído na aba **Instagram** do painel.

⚠️ **Nunca cole nenhuma chave, token ou segredo no chat com a IA, nem em
nenhum arquivo deste repositório.** Este repositório é público (é o mesmo que
publica o site em `edilainesantos.com`). Toda chave sensível vai **só** nos
secrets das Edge Functions, dentro do painel do Supabase, exatamente como já
funciona hoje com a `ANTHROPIC_API_KEY` da função `ia-assistente`.

## 0. O que já está pronto neste repositório

- `painel.html`: a aba Instagram (Métricas e Automações), com o editor visual
  e a prévia ao vivo. Já funciona sem nenhuma configuração adicional, mas
  ainda não manda DM de verdade sem o resto deste guia.
- `setup.sql`: as tabelas `ig_*`, o freio de envio (`take_send_slot` /
  `record_send_result`) e o RLS. Seção "INSTAGRAM: AUTOMAÇÃO DE DM".
- `supabase/functions/`: as 5 Edge Functions do motor (`instagram-webhook`,
  `ig-scheduler`, `ig-token-refresh`, `ig-insights`, `ig-media`) e o módulo
  compartilhado `_shared/ig.ts`.

O que falta é só **configurar e publicar** o que já está escrito.

## 1. Rodar o SQL

1. Abra o SQL Editor do seu projeto Supabase.
2. Cole o conteúdo inteiro do `setup.sql` (pode rodar de novo mesmo se já
   rodou antes, todo o script usa `if not exists`/`on conflict`, é seguro).
3. **Não rode ainda** o bloco final "AGENDAMENTO (pg_cron + pg_net)". Ele
   depende do `SCHED_SECRET`, que você só vai definir no passo 2. Volte nele
   no passo 4.

## 2. Configurar os segredos das Edge Functions

No painel do Supabase: **Project Settings > Edge Functions > Secrets** (ou
pela CLI, com `supabase secrets set NOME=valor`). Nenhum destes vai em
arquivo nenhum do repositório:

| Segredo | O que é | Onde conseguir |
|---|---|---|
| `IG_ACCESS_TOKEN` | Token de acesso de longa duração da conta do Instagram | Meta for Developers, depois de conectar a conta profissional (fluxo "Instagram API with Instagram Login") |
| `IG_ACCOUNT_ID` | ID numérico da conta profissional do Instagram | Aparece no Meta for Developers ao conectar a conta, ou via `GET /me?fields=user_id` |
| `APP_SECRET` | Segredo do app criado no Meta for Developers | Configurações básicas do app, no Meta for Developers |
| `APP_SECRET_ENFORCE` | `"false"` no começo (modo teste), `"true"` depois de testar | Você decide (ver passo 7) |
| `VERIFY_TOKEN` | Uma senha qualquer que você mesma inventa | Invente uma string qualquer, sem espaço |
| `GRAPH_API_VERSION` | Versão da Graph API | `v21.0` (já é o padrão se você não definir nada) |
| `SCHED_SECRET` | Outra senha que você inventa, protege o `ig-scheduler`/`ig-token-refresh` | Invente uma string qualquer |
| `TEST_IG_ACCOUNTS` | IDs numéricos (separados por vírgula) de contas de teste | O ID da sua própria conta pessoal de teste no Instagram, se quiser testar sem esperar 24h |
| `SUPABASE_URL` | URL do seu projeto | Já aparece em `js/auth.js`, é a mesma |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de service_role (ignora o RLS) | Project Settings > API, campo "service_role" (**nunca** a "anon") |

## 3. Publicar as Edge Functions

Usando a Supabase CLI (`npm install -g supabase`, depois `supabase login` e
`supabase link --project-ref SEU_PROJETO` uma vez só):

```bash
# instagram-webhook e as duas chamadas pelo pg_cron precisam ser PÚBLICAS
# (sem verificação de JWT do Supabase), porque quem chama é o servidor da
# Meta ou o próprio pg_cron, não alguém logado no painel.
supabase functions deploy instagram-webhook --no-verify-jwt
supabase functions deploy ig-scheduler --no-verify-jwt
supabase functions deploy ig-token-refresh --no-verify-jwt

# ig-insights e ig-media são chamadas pelo painel.html (pessoa logada),
# então mantêm a verificação de JWT ligada (padrão, sem a flag)
supabase functions deploy ig-insights
supabase functions deploy ig-media
```

Se preferir, também dá pra colar o conteúdo de cada `index.ts` direto no
editor de Edge Functions do painel do Supabase, sem usar a CLI; nesse caso,
a opção "Verify JWT" fica no formulário da própria função (desligue só pra
`instagram-webhook`, `ig-scheduler` e `ig-token-refresh`).

## 4. Agendar os robôs (pg_cron)

Volte no `setup.sql`, no bloco "AGENDAMENTO (pg_cron + pg_net)", e troque:
- `SEU_PROJETO` pela referência do seu projeto (a parte antes de
  `.supabase.co` na URL do projeto).
- `SEU_SCHED_SECRET` pelo mesmo valor que você colocou no secret
  `SCHED_SECRET` no passo 2.

Rode só esse bloco no SQL Editor. Ele liga o `ig-scheduler` a cada 1 minuto
e o `ig-token-refresh` toda segunda-feira às 3h.

## 5. Configurar o webhook no Meta for Developers

1. No app do Meta for Developers, vá em **Webhooks** (ou no produto
   Instagram, conforme a versão do painel da Meta).
2. URL de callback: `https://SEU_PROJETO.supabase.co/functions/v1/instagram-webhook`
3. Token de verificação: o mesmo valor do secret `VERIFY_TOKEN`.
4. Assine os campos: **comments**, **messages** e **messaging_postbacks**
   (os três; o `messaging_postbacks` é o que faz os botões da conversa
   funcionarem).

## 6. Testar

1. Com uma **segunda conta** do Instagram (a sua própria é ignorada de
   propósito, pra não responder a si mesma), comente a palavra-chave de uma
   automação ativa num post.
2. Confira no painel do Supabase (Table Editor) se apareceu uma linha em
   `ig_send_queue` e depois em `ig_deliveries`.
3. Toque no botão da DM recebida e confira se a conversa avança.
4. Se algo não funcionar, veja os logs da função `instagram-webhook` em
   Edge Functions > Logs, no painel do Supabase.

## 7. Ligar a trava de segurança

Depois que tudo tiver sido testado e estiver funcionando, mude o secret
`APP_SECRET_ENFORCE` de `"false"` para `"true"`. Isso faz o webhook passar a
**recusar** (em vez de só avisar no log) qualquer chamada que não tenha a
assinatura certa do Meta, fechando o único ponto que ficou deliberadamente
mais aberto pra facilitar os primeiros testes.

## Regras e limites (o motor já foi construído respeitando isso)

- **Opt-in sempre**: só responde quem comentou ou mandou mensagem primeiro.
- **1 por dia**: no máximo 1 DM por pessoa a cada 24h por gatilho de
  comentário (contas em `TEST_IG_ACCOUNTS` ignoram essa regra).
- **Freio de envio**: por padrão, no máximo 6 por minuto, 60 por hora e 180
  por dia (bem abaixo do teto da Meta), com um disjuntor que pausa os envios
  por 3 horas depois de 3 falhas "duras" seguidas (ex: bloqueio).
- **Janela de 24h da Meta**: fora de uma interação recente, não dá pra
  mandar DM; o comentário e o toque no botão são o que abre essa janela.
- **Limites de mensagem**: título de botão até 20 caracteres, no máximo 3
  botões por mensagem no formato anexado (mais que isso cai pro formato de
  pílula, que aceita até 13), resposta a um comentário só vale
  aproximadamente 7 dias.
- **Nada de spam nem lista comprada**: o motor nunca inicia uma conversa com
  quem nunca interagiu.

## Se algo não sair do ar

- **Nenhuma DM sai nunca**: confira se `take_send_slot` existe no banco
  (rodou o SQL?) e se os secrets `IG_ACCESS_TOKEN`/`IG_ACCOUNT_ID` estão
  certos.
- **Os botões não avançam a conversa**: confira se o campo
  `messaging_postbacks` foi mesmo assinado no passo 5.
- **A fila nunca anda**: confira se o `ig-scheduler` está agendado (passo 4)
  e se o secret `SCHED_SECRET` bate dos dois lados (Edge Function e SQL).
- **Métricas/posts não aparecem no painel**: confira se `ig-insights` e
  `ig-media` foram publicadas (passo 3) e se `IG_ACCESS_TOKEN`/`IG_ACCOUNT_ID`
  estão certos.
