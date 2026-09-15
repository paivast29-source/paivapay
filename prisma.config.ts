import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

// O Prisma CLI nao le o .env sozinho a partir da versao 7, e o carregamento
// automatico do Next nao vale aqui - este arquivo roda fora do Next.
// loadEnvFile e nativo do Node (>= 20.6), entao nao precisamos do dotenv.
try {
  loadEnvFile(".env");
} catch {
  // Sem .env local: as variaveis ja devem vir do ambiente (CI, producao).
}

/**
 * Configuracao do Prisma CLI (migrations, seed, studio).
 *
 * A partir do Prisma 7 a connection string sai do schema.prisma e passa a ser
 * declarada aqui. Em tempo de execucao, quem carrega a URL e o driver adapter
 * montado em lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
