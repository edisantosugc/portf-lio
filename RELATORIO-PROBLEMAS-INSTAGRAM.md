# Relatório: problemas com tokens e credenciais ao ativar a automação do Instagram

Registro dos perrengues de configuração enfrentados pra deixar a automação do
Instagram funcionando de ponta a ponta.

## 1. ID da conta do Instagram errado

**O que aconteceu:** a função `ig-insights` retornava erro 502, com a
mensagem da Graph API "Unsupported get request... Object with ID '...' does
not exist".

**Causa:** o valor cadastrado no secret `IG_ACCOUNT_ID` não era o ID correto
pra aquele token (era de outra coisa, possivelmente confundido com um ID de
Página do Facebook).

**Como resolvemos:** descobrimos o ID certo chamando
`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=...`
direto no navegador e atualizamos o secret com o valor correto.

## 2. Conta de teste sem autorização completa

**O que aconteceu:** comentários de teste feitos por uma conta específica
não geravam nenhum evento.

**Causa:** enquanto o app está em modo de desenvolvimento, só contas
cadastradas como "Testador do Instagram" (nas Funções do app) E que
aceitaram esse convite pelo próprio Instagram (Central de Contas > Apps e
sites) conseguem gerar eventos de teste. São dois passos separados, fácil
esquecer o segundo.

## 3. Faltava inscrever a conta no webhook

**O que aconteceu:** mesmo com o testador liberado, nenhum comentário
chegava no webhook. A aba "Invocations" da função só mostrava os GETs de
verificação, nunca um POST.

**Causa:** configurar a URL e os campos do webhook no painel da Meta não
basta. A conta profissional do Instagram também precisa ser **inscrita**
explicitamente, via uma chamada própria da API
(`POST /{ig-user-id}/subscribed_apps?subscribed_fields=...`). Sem isso, o
app "escuta" mas a conta nunca "avisa". Foi o passo mais difícil de
descobrir.

**Como resolvemos:** rodamos essa chamada de inscrição direto no navegador
(usando `&method=post` pra simular um POST pela barra de endereço), e depois
disso o webhook passou a receber os eventos normalmente.

## 4. Confusão com secrets reservados (prefixo SUPABASE_)

**O que aconteceu:** ao tentar cadastrar `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` como secrets das Edge Functions, deu o erro
"Name must not start with the SUPABASE_ prefix".

**Causa:** esses valores já ficam disponíveis automaticamente dentro de
toda Edge Function, sem precisar cadastrar. O painel bloqueia esse prefixo
de propósito.

**Como resolvemos:** simplesmente não cadastramos esses dois, e o código já
funcionou normalmente lendo eles como variável de ambiente padrão.

## 5. Chave da IA (Anthropic) nunca configurada

**O que aconteceu:** o botão "Analisar com IA" (aba Análises) e o
assistente "Crô" davam o erro "ANTHROPIC_API_KEY não configurada".

**Causa:** essa chave nunca foi gerada nem cadastrada. Também ficou claro
que o Claude Pro (assinatura pessoal em claude.ai) é um produto diferente
da API da Anthropic (console.anthropic.com, cobrança por uso), e um não dá
acesso ao outro.

**Como ficou:** decidido deixar essa parte pra configurar depois. O resto
do painel funciona normalmente sem essa chave; só o recurso de IA
específico fica esperando.
