/* =========================================================================
   js/auth.js
   Configuração do Supabase e funções de autenticação compartilhadas
   entre login.html e painel.html. Este arquivo cria o cliente do Supabase
   UMA ÚNICA VEZ e expõe tudo através de window.Auth.
   ========================================================================= */

// EDITE AQUI SE VOCÊ RECRIAR O PROJETO NO SUPABASE (trocar URL e chave)
const SUPABASE_URL = "https://dqtoxxngjqyoibdgmrjr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdG94eG5nanF5b2liZGdtcmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzYyNDMsImV4cCI6MjA5OTM1MjI0M30.sC16nHTB5f_cieiuIGOd86qb3186m4pnC2J2IWODPSc";

// Cliente do Supabase, criado uma única vez e reaproveitado em todo o painel
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.Auth = {

  // Cliente exposto para quem precisar consultar as tabelas (usado no painel.html)
  client: sb,

  // Faz login com e-mail e senha. Lança um erro com mensagem em português.
  async login(email, senha) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: senha
    });

    if (error) {
      if (error.message === "Invalid login credentials") {
        throw new Error("E-mail ou senha incorretos.");
      }
      throw new Error(error.message);
    }

    return data.user;
  },

  // Guarda de autenticação: roda no topo de páginas protegidas.
  // Se não houver sessão, redireciona para login.html e devolve null.
  async checkAuth() {
    const { data } = await sb.auth.getSession();

    if (!data.session) {
      window.location.href = "login.html";
      return null;
    }

    return data.session.user;
  },

  // Encerra a sessão e volta para a tela de login
  async logout() {
    await sb.auth.signOut();
    window.location.href = "login.html";
  },

  // Envia o e-mail de recuperação de senha
  async recuperarSenha(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) {
      throw new Error(error.message);
    }
  }
};
