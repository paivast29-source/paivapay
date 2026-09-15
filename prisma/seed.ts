import { loadEnvFile } from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { validarForcaSenha } from "../lib/auth/senha";

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
 * E idempotente: rodar duas vezes nao duplica nada. Roda tambem no deploy
 * (ver scripts/preparar-banco.mjs), por isso precisa ser seguro em producao.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SENHAS_PROIBIDAS = ["mudar123", "senha123", "admin123", "123456"];

const ehProducao = process.env.NODE_ENV === "production";

async function semearContaRecebedora() {
  const nome = process.env.CONTA_RECEBEDORA_NOME || "Paiva Studio";

  const existente = await db.contaRecebedora.findFirst({
    where: { padrao: true },
  });

  if (existente) {
    console.log(`. conta recebedora padrao ja existe: ${existente.nome}`);
    return;
  }

  const conta = await db.contaRecebedora.create({
    data: { nome, padrao: true },
  });
  console.log(`+ conta recebedora padrao criada: ${conta.nome}`);
}

/**
 * Cria o primeiro diretor.
 *
 * SEGURANCA: em producao a senha precisa vir de SEED_ADMIN_SENHA, ser forte e
 * nao estar na lista de senhas conhecidas.
 *
 * O motivo e direto: o `.env.example` deste repositorio e publico e traz
 * "mudar123" como exemplo. Se o seed aceitasse esse padrao em producao, o
 * primeiro deploy criaria um diretor com e-mail e senha que qualquer pessoa le
 * no GitHub - acesso total ao painel financeiro. Preferimos subir sem usuario
 * nenhum a subir com um usuario que todo mundo sabe acessar.
 */
async function semearPrimeiroDiretor() {
  // Se ja existe qualquer diretor, nao mexemos. O seed nunca altera usuario
  // existente - trocar senha e coisa do painel, nao de rotina automatica.
  const jaExisteDiretor = await db.usuario.findFirst({
    where: { papel: "diretor" },
  });

  if (jaExisteDiretor) {
    console.log(`. diretor ja existe: ${jaExisteDiretor.email}`);
    return;
  }

  const email = (
    process.env.SEED_ADMIN_EMAIL || "umberto@paivast.com.br"
  ).toLowerCase();
  const nome = process.env.SEED_ADMIN_NOME || "Umberto Paiva";
  const senha = process.env.SEED_ADMIN_SENHA;

  if (ehProducao) {
    if (!senha) {
      // Falha o deploy de proposito, em vez de apenas avisar.
      //
      // Um site publicado sem nenhum usuario cadastrado parece funcionar: a
      // tela de login abre normalmente e so quebra - ou recusa - quando alguem
      // tenta entrar. O sintoma fica longe da causa. Falhar aqui, com o texto
      // abaixo no log do deploy, e a unica forma de a mensagem chegar a quem
      // pode resolver.
      //
      // E uma porta que se atravessa uma vez: assim que o primeiro diretor
      // existir, este bloco nem e alcancado nos deploys seguintes.
      throw new Error(
        [
          "",
          "===========================================================",
          " NENHUM USUARIO ADMINISTRADOR EXISTE E SEED_ADMIN_SENHA",
          " NAO FOI DEFINIDA. O DEPLOY FOI INTERROMPIDO.",
          "===========================================================",
          "",
          " Defina estas variaveis de ambiente no painel de hospedagem",
          " e refaca o deploy:",
          "",
          "   SEED_ADMIN_EMAIL   e-mail de quem vai administrar",
          "   SEED_ADMIN_SENHA   senha forte, so sua (min. 8 caracteres,",
          "                      com letras e numeros)",
          "   SEED_ADMIN_NOME    nome exibido no painel",
          "",
          " Nao usamos uma senha padrao aqui de proposito: o .env.example",
          " deste repositorio e publico, e qualquer padrao viraria acesso",
          " conhecido ao painel financeiro.",
          "",
          " Isto e cobrado uma unica vez. Depois que o primeiro diretor",
          " existir, os proximos deploys nao pedem mais nada.",
          "",
        ].join("\n"),
      );
    }

    if (SENHAS_PROIBIDAS.includes(senha.toLowerCase())) {
      throw new Error(
        `SEED_ADMIN_SENHA="${senha}" e uma senha de exemplo, publica neste repositorio. Escolha outra.`,
      );
    }

    const problema = validarForcaSenha(senha);
    if (problema) {
      throw new Error(`SEED_ADMIN_SENHA recusada: ${problema}`);
    }
  }

  // Em desenvolvimento o padrao continua valendo, para o setup local ser de
  // um comando so.
  const senhaFinal = senha || "mudar123";

  await db.usuario.create({
    data: {
      nome,
      email,
      senhaHash: await hash(senhaFinal, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      papel: "diretor",
      ativo: true,
    },
  });

  console.log(`+ usuario diretor criado: ${email}`);

  if (!ehProducao) {
    console.log(`  senha: ${senhaFinal}`);
    console.log("  TROQUE ESTA SENHA ANTES DE QUALQUER USO REAL.");
  }
}

async function main() {
  await semearContaRecebedora();
  await semearPrimeiroDiretor();
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
