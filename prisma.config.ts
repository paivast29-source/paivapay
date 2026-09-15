import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

// O Prisma CLI nao le o .env sozinho a partir da versao 7, e o carregamento
// automatico do Next nao vale aqui - este arquivo roda fora do Next.
// loadEnvFile e nativo do Node (>= 20.6), entao nao precisamos do dotenv.
try {
  loadEnvFile(".env");
} catch {
  // Sem .env local: as variaveis ja devem vir do ambiente (CI, producao).
}

/**
 * Connection string usada pelas MIGRATIONS.
 *
 * Provedores serverless como Neon e Supabase entregam dois enderecos para o
 * mesmo banco:
 *
 *   - com pool (host termina em "-pooler"): um PgBouncer em modo transacao.
 *     E o certo para a aplicacao, porque cada instancia serverless abre a
 *     propria conexao e o limite do Postgres estoura rapido sem ele.
 *
 *   - direto (sem "-pooler"): conexao normal ao Postgres.
 *
 * Migrations PRECISAM do endereco direto. Elas usam advisory locks para
 * garantir que duas nao rodem ao mesmo tempo, e advisory lock nao sobrevive ao
 * pooling em modo transacao - a migration trava ou falha sem explicacao clara.
 *
 * Por isso: se DIRECT_DATABASE_URL existir, ela manda aqui. Caso contrario
 * usamos DATABASE_URL, o que cobre o desenvolvimento local (Postgres direto,
 * sem pooler) e provedores que nao separam os dois enderecos.
 */
const urlBanco = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

/**
 * Configuracao do Prisma CLI (migrations, seed, studio).
 *
 * A partir do Prisma 7 a connection string sai do schema.prisma e passa a ser
 * declarada aqui. Em tempo de execucao, quem carrega a URL e o driver adapter
 * montado em lib/db.ts.
 *
 * POR QUE O datasource E CONDICIONAL:
 *
 * `prisma generate` nao acessa o banco - ele so le o schema e escreve o cliente
 * TypeScript. Quem precisa de conexao e `migrate`, `db seed` e `studio`.
 *
 * Usar o helper env() aqui tornava DATABASE_URL obrigatoria para QUALQUER
 * comando, inclusive o generate. Como o generate roda no postinstall, o build
 * quebrava em qualquer ambiente sem a variavel - foi exatamente o que derrubou
 * o primeiro deploy na Vercel, antes de o banco de producao existir.
 *
 * Declarando o datasource so quando a variavel existe, o generate passa a
 * funcionar sem banco nenhum, e os comandos que de fato precisam de conexao
 * continuam falhando de forma clara quando ela falta.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(urlBanco ? { datasource: { url: urlBanco } } : {}),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
