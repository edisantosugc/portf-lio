# Painel Administrativo - Edilaine Santos

Painel privado para acompanhar os números do portfólio: visitas, cliques, vídeos assistidos e mensagens recebidas pelo site.

## Arquivos

- `login.html`: tela de login.
- `painel.html`: painel interno, protegido por login.
- `js/auth.js`: configuração do Supabase e funções de login/logout compartilhadas.
- `setup.sql`: script para criar as tabelas no Supabase.

## Como publicar (6 passos)

1. **Rode o `setup.sql`**: entre no seu projeto Supabase, abra o SQL Editor e cole o conteúdo do arquivo `setup.sql`, depois clique em "Run". Isso cria as tabelas `portfolio_events` e `portfolio_leads` já protegidas.
2. **Crie seu usuário de login**: no painel do Supabase, vá em Authentication > Users > Add user, coloque seu e-mail e uma senha. Esse é o login que você vai usar no `login.html`.
3. **Confira as chaves em `js/auth.js`**: a URL e a chave publica ("anon") do seu projeto já estão preenchidas no topo do arquivo. Só precisa trocar se você recriar o projeto no Supabase.
4. **Teste localmente**: dê duplo clique em `login.html` para abrir no navegador, faça login com o usuário criado no passo 2 e confira se o painel carrega (mesmo sem dados ainda, ele deve abrir normalmente).
5. **Publique**: envie os arquivos `login.html`, `painel.html` e a pasta `js` (com o `auth.js` dentro) para o mesmo repositório do GitHub que já hospeda o seu site, pelo mesmo processo de "Upload files" que você já usa para o `index.html`.
6. **Acesse**: depois do deploy (alguns minutos), seu painel fica disponível em `https://edilainesantos.com/login.html`.

## Ainda sem dados?

Se as tabelas estiverem vazias, o painel mostra frases como "Nenhuma visita registrada ainda." em vez de quebrar a tela. Os números só aparecem quando o seu site (pelo servidor, com a chave de serviço) começar a gravar eventos em `portfolio_events` e mensagens em `portfolio_leads`. Isso é um projeto separado, que grava os dados que este painel exibe.
