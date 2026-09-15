import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";
import { urlBancoMigracoes } from "./lib/url-banco";

// O Prisma CLI nao le o .env sozinho a partir da versao 7, e o carregamento
// automatico do Next nao vale aqui - este arquivo roda fora do Next.
// loadEnvFile e nativo do Node (>= 20.6), entao nao precisamos do dotenv.
try {
  loadEnvFile(".env");
} catch {
  // Sem .env local: as variaveis ja devem vir do ambiente (CI, producao).
}

// Migrations usam sempre a conexao direta quando ela existe. Os nomes de
// variavel aceitos e o porque estao em lib/url-banco.ts.
const urlBanco = urlBancoMigracoes();

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
