import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { urlBancoAplicacao } from "@/lib/url-banco";

/**
 * Cliente do banco.
 *
 * A partir do Prisma 7 a conexao e feita por driver adapter: a connection
 * string nao vem mais do schema.prisma, e sim daqui.
 *
 * INICIALIZACAO PREGUICOSA - por que o Proxy:
 *
 * A versao anterior criava o cliente na avaliacao do modulo (`export const db =
 * criarCliente()`). Isso transformava DATABASE_URL em requisito de BUILD, e nao
 * apenas de execucao: o `next build` importa cada modulo de rota na etapa de
 * coleta de configuracao, entao o throw disparava durante o build e derrubava o
 * deploy inteiro - foi o que aconteceu na Vercel.
 *
 * Construir um PrismaClient nao abre conexao (isso so acontece na primeira
 * consulta), mas a nossa verificacao de variavel rodava cedo demais. Com o
 * Proxy, o cliente so nasce no primeiro acesso de verdade - `db.cobranca...` -
 * o que mantem a mensagem de erro clara em tempo de execucao e deixa o build
 * passar sem banco nenhum, como deve ser.
 */

function criarCliente(): PrismaClient {
  const connectionString = urlBancoAplicacao();

  if (!connectionString) {
    throw new Error(
      "Nenhuma connection string encontrada. Em desenvolvimento: copie .env.example para .env e rode `npm run db:up`. " +
        "Em producao: defina DATABASE_URL apontando para o Postgres.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Cache global. Em desenvolvimento o Next recarrega os modulos a cada
// alteracao; sem isto, cada recarga abriria um novo pool de conexoes e o
// Postgres esgotaria o limite em poucos minutos. Em producao o modulo e
// avaliado uma vez so, e o cache apenas garante uma instancia por processo.
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function obterCliente(): PrismaClient {
  globalParaPrisma.prisma ??= criarCliente();
  return globalParaPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade) {
    const cliente = obterCliente();
    const valor = Reflect.get(cliente, propriedade);

    // Metodos do proprio cliente ($transaction, $disconnect, $queryRaw) perdem
    // o `this` ao serem extraidos pelo Proxy. Os delegates de modelo
    // (db.cobranca, db.cliente) sao objetos e ja carregam o proprio contexto,
    // entao passam direto.
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
