import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Cliente do banco.
 *
 * A partir do Prisma 7 a conexao e feita por driver adapter: a connection
 * string nao vem mais do schema.prisma, e sim daqui.
 */

function criarCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nao configurada. Copie .env.example para .env e suba o banco com: npm run db:up",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Em desenvolvimento o Next recarrega os modulos a cada alteracao. Sem este
// cache global, cada recarga abriria um novo pool de conexoes e o Postgres
// esgotaria o limite em poucos minutos.
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalParaPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = db;
}
