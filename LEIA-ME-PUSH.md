# Notificações push (painel + Portal do Gustavo)

Passo a passo pra ligar de verdade as notificações que chegam no celular
mesmo com o app fechado (contas vencendo, compromissos do dia, pensão da
Lívia, aviso de mês fechado).

⚠️ **Nunca cole nenhuma chave, token ou segredo no chat com a IA, nem em
nenhum arquivo deste repositório.** Este repositório é público. Toda chave
sensível vai **só** nos secrets das Edge Functions, dentro do painel do
Supabase — exatamente como já funciona com a automação de Instagram (ver
`LEIA-ME-INSTAGRAM.md`).

## 0. O que já está pronto neste repositório

- `sw.js`: o service worker (recebe a notificação mesmo com o app fechado).
- `js/push.js`: liga/desliga a notificação no navegador, usado tanto pelo
  `painel.html` quanto pelo `gustavo/index.html`.
- Botão **🔔 Ativar notificações** na barra lateral do painel, e **🔔
  Ativar avisos** no topo do Portal do Gustavo.
- `setup.sql`: tabela `push_subscricoes` (guarda quem está inscrito) e o
  agendamento diário — seção "NOTIFICAÇÕES PUSH".
- `supabase/functions/send-push/index.ts`: a Edge Function que manda a
  notificação de verdade. Roda de dois jeitos: (1) chamada direto pelo
  painel na hora que você fecha um mês, avisando o Gustavo; (2) 1x por dia
  (8h de Brasília), verificando contas vencendo/compromissos do dia (pra
  você) e a pensão perto de vencer (pro Gustavo).

O que falta é só **gerar as chaves, configurar os segredos e publicar a
função** — igual já foi feito com a automação de Instagram.

## 1. Gerar as chaves VAPID (identifica o site pros serviços de push)

Já gerei um par de chaves pra você — a pública já está em `js/push.js`
(não é segredo, pode ficar no repositório). A **privada** eu te mandei
direto no chat, nunca em arquivo nenhum. Guarde ela num lugar seguro (tipo
o gerenciador de senhas), você vai usar no passo 2.

Se um dia precisar gerar um par novo (só necessário se a chave vazar), me
peça — eu gero de novo do mesmo jeito.

## 2. Rodar o SQL

1. Abra o SQL Editor do seu projeto Supabase.
2. Copie do `setup.sql` a partir do comentário `-- NOTIFICAÇÕES PUSH` até o
   fim do arquivo.
3. **Antes de rodar**, troque `SEU_SCHED_SECRET` (no bloco `cron.schedule`
   no final) pelo mesmo valor que já está configurado no secret
   `SCHED_SECRET` das suas Edge Functions (o mesmo que o `ig-scheduler` já
   usa — não precisa criar um novo).
4. Clique em **Run**.

## 3. Configurar os segredos da função `send-push`

Painel do Supabase: **Project Settings > Edge Functions > Secrets** (ou
`supabase secrets set NOME=valor` pela CLI).

| Segredo | O que é |
|---|---|
| `VAPID_PUBLIC_KEY` | A mesma chave pública que já está em `js/push.js` |
| `VAPID_PRIVATE_KEY` | A chave privada que te mandei no chat (passo 1) |
| `VAPID_SUBJECT` | `mailto:edilainesantosugc@gmail.com` (ou outro e-mail seu) |
| `SCHED_SECRET` | Já deve existir (reaproveitado do Instagram) — se não existir, invente uma senha qualquer |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não precisam ser cadastrados —
toda Edge Function já recebe isso automaticamente.

## 4. Publicar a Edge Function

```bash
supabase functions deploy send-push
```

Essa mantém a verificação de login ligada (padrão, sem `--no-verify-jwt`),
porque tanto o painel quanto o pg_cron mandam um jeito de se identificar
(login normal ou o header `x-sched-key`).

## 5. Testar

1. Recarregue o painel e clique em **🔔 Ativar notificações** (e o mesmo no
   Portal do Gustavo, no aparelho dele). O navegador vai pedir permissão —
   aceite.
2. Feche o app de verdade (não só minimize) e feche um mês no painel — deve
   chegar uma notificação no celular do Gustavo em poucos segundos.
3. Pro aviso diário (contas vencendo, compromissos, pensão), só vai
   aparecer de verdade quando alguma dessas coisas estiver realmente
   vencendo dentro de 3 dias — não dá pra testar na hora sem ter uma conta
   configurada assim no banco.

⚠️ No iPhone, notificação push só funciona se o app já estiver instalado na
tela de início (Safari > Compartilhar > Adicionar à Tela de Início) e em
iOS 16.4 ou mais novo. Numa aba comum do Safari, sem instalar, não funciona.
