import { loadEnvFile } from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

// O seed roda como processo separado, fora do Next e fora do CLI do Prisma.
try {
  loadEnvFile(".env");
} catch {
  // Sem .env local: as variaveis vem do ambiente.
}

/**
 * Seed do banco.
 *
 * Cria o minimo necessario para a aplicacao funcionar:
 *
 *  1. A conta recebedora padrao (secao 4.3). Sem ela nenhuma cobranca pode ser
 *     criada, porque toda cobranca exige conta_recebedora_id.
 *
 *  2. O primeiro usuario diretor, para que exista alguem capaz de entrar no
 *     painel e criar os demais.
 *
 * E idempotente: rodar duas vezes nao duplica nada.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // ---- Conta recebedora padrao ---------------------------------------------
  const nomeConta = process.env.CONTA_RECEBEDORA_NOME || "Paiva Studio";

  const contaExistente = await db.contaRecebedora.findFirst({
    where: { padrao: true },
  });

  if (contaExistente) {
    console.log(`. conta recebedora padrao ja existe: ${contaExistente.nome}`);
  } else {
    const conta = await db.contaRecebedora.create({
      data: { nome: nomeConta, padrao: true },
    });
    console.log(`+ conta recebedora padrao criada: ${conta.nome}`);
  }

  // ---- Usuario diretor -----------------------------------------------------
  const email = (
    process.env.SEED_ADMIN_EMAIL || "umberto@paivast.com.br"
  ).toLowerCase();
  const senha = process.env.SEED_ADMIN_SENHA || "mudar123";
  const nome = process.env.SEED_ADMIN_NOME || "Umberto Paiva";

  const usuarioExistente = await db.usuario.findUnique({ where: { email } });

  if (usuarioExistente) {
    console.log(`. usuario ja existe: ${email}`);
  } else {
    await db.usuario.create({
      data: {
        nome,
        email,
        senhaHash: await hash(senha, {
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
        papel: "diretor",
        ativo: true,
      },
    });
    console.log(`+ usuario diretor criado: ${email}`);
    console.log(`  senha: ${senha}`);
    console.log("  TROQUE ESTA SENHA ANTES DE QUALQUER USO REAL.");
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (erro) => {
    console.error("falha no seed:", erro);
    await db.$disconnect();
    process.exit(1);
  });
