/**
 * Resolucao das connection strings do banco.
 *
 * Provedores serverless expoem DOIS enderecos para o mesmo banco:
 *
 *   - com pool: um PgBouncer em modo transacao. E o certo para a aplicacao,
 *     porque cada instancia serverless abre a propria conexao e o limite do
 *     Postgres estoura rapido sem ele.
 *
 *   - direto: conexao normal. Migrations PRECISAM dele - elas usam advisory
 *     locks para impedir execucao concorrente, e advisory lock nao sobrevive ao
 *     pooling em modo transacao.
 *
 * O problema e que cada forma de configurar batiza essas variaveis de um jeito.
 * Quem cola a string a mao usa os nomes do nosso .env.example; a integracao
 * Neon/Vercel injeta DATABASE_URL_UNPOOLED; a do Vercel Postgres e a do
 * Supabase usam POSTGRES_URL_NON_POOLING.
 *
 * Aceitar os tres evita a classe de erro mais chata que existe nisso: tudo
 * parece configurado, e o sistema se comporta como se nao houvesse banco.
 */

/** Conexao que a aplicacao usa em tempo de execucao. Prefira a com pool. */
export function urlBancoAplicacao(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    undefined
  );
}

/**
 * Conexao usada por migrations e seed. Prefere sempre a direta; cai para a da
 * aplicacao quando o provedor nao separa as duas - o caso do Postgres local em
 * Docker, que e direto e nao tem pooler.
 */
export function urlBancoMigracoes(): string | undefined {
  return (
    process.env.DIRECT_DATABASE_URL ||
    // Nome usado pela integracao Neon <-> Vercel.
    process.env.DATABASE_URL_UNPOOLED ||
    // Nome usado pelas integracoes do Vercel Postgres e do Supabase.
    process.env.POSTGRES_URL_NON_POOLING ||
    urlBancoAplicacao()
  );
}
