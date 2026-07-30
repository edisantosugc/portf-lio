# Ativar chat do Crô e análise de IA

**Status:** pendente — aguardando decisão de pagar a API da Anthropic.

## O que falta (2 passos)

1. **Rodar o SQL da tabela `painel_ia_mensagens`**
   Já está pronto em `setup.sql` (bloco `create table if not exists
   public.painel_ia_mensagens ...`). Só falta executar esse trecho no SQL
   Editor do Supabase.

2. **Gerar e cadastrar a chave `ANTHROPIC_API_KEY`**
   Gerar em console.anthropic.com (API paga por uso — diferente do Claude
   Pro/claude.ai). Cadastrar como secret `ANTHROPIC_API_KEY` em
   Project Settings > Edge Functions > Secrets, no Supabase.

## O que isso ativa

- O chat do Crô (assistente de IA), usado em 6 sub-abas do painel (4 do Crô
  + 2 da Negociação).
- O botão "Analisar com IA" na aba Instagram > Análises (função
  `ig-analise-conteudo`).

## Como retomar

Quando você tiver a chave da Anthropic em mãos, é só dizer algo como
"tenho a API da Anthropic, vamos ativar as pendências" — os passos são
exatamente os dois acima, nada mais.
