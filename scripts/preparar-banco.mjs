import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { loadEnvFile } from "node:process";

// Este script roda ANTES do next build, e quem carrega o .env e o Next. Sem
// isto, `npm run build` local pularia a preparacao em silencio enquanto na
// Vercel ela aconteceria - dois comportamentos diferentes para o mesmo comando.
// Em producao nao existe .env e as variaveis ja vem do ambiente.
try {
  loadEnvFile(".env");
} catch {
  // Sem .env: as variaveis vem do ambiente (CI, Vercel).
}

/**
 * Prepara o banco durante o deploy.
 *
 * POR QUE ISTO EXISTE:
 *
 * Criar um Postgres na nuvem e apontar DATABASE_URL para ele nao cria tabela
 * nenhuma - o banco nasce vazio. Sem este passo, o build termina com sucesso, o
 * site sobe, e a primeira consulta falha com "relation ... does not exist". O
 * sintoma aparece longe da causa: a pagina de login abre normalmente (ela nao
 * toca no banco quando nao ha cookie) e so quebra ao enviar o formulario.
 *
 * Rodar as migrations no deploy resolve isso de uma vez e continua valendo para
 * toda mudanca de schema futura, sem depender de alguem lembrar de um comando.
 *
 * COMPORTAMENTO:
 *
 *  - Sem DATABASE_URL: nao faz nada e deixa o build seguir. Isso preserva a
 *    propriedade de que compilar nao exige banco - o que importa para builds de
 *    verificacao e para o proprio `npm run build` local sem o Docker de pe.
 *
 *  - Com DATABASE_URL: aplica as migrations pendentes e roda o seed. Ambos sao
 *    idempotentes. Se qualquer um falhar, o build falha junto: um deploy cujo
 *    banco nao pode ser preparado geraria um site quebrado de qualquer forma, e
 *    e melhor descobrir no deploy do que pelo usuario.
 */

// As migrations preferem a conexao direta quando ela existe - ver o comentario
// em prisma.config.ts sobre advisory locks e pooler.
const urlBanco = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!urlBanco) {
  console.log(
    "[preparar-banco] DATABASE_URL ausente - pulando migrations e seed.\n" +
      "                 O build segue; o site precisara da variavel para funcionar.",
  );
  process.exit(0);
}

// Nao imprime a URL: ela carrega usuario e senha do banco, e o log de build
// costuma ser mais visivel do que se imagina.
const hospedeiro = (() => {
  try {
    return new URL(urlBanco).host;
  } catch {
    return "(url em formato nao reconhecido)";
  }
})();

console.log(`[preparar-banco] preparando o banco em ${hospedeiro}`);

// Caminho do CLI do Prisma resolvido pelo proprio Node.
//
// Chamamos `node <caminho>` em vez de `npx prisma`: o npx no Windows e um
// .cmd, o que obrigaria a usar shell:true - e passar argumentos por shell gera
// o DeprecationWarning DEP0190 do Node, alem de ser um vetor de injecao quando
// algum argumento deixa de ser constante. Invocando o arquivo .js direto, o
// mesmo codigo funciona em Windows e no Linux da Vercel, sem shell nenhum.
const require = createRequire(import.meta.url);
const cliPrisma = require.resolve("prisma/build/index.js");

// O `prisma db seed` executa o comando declarado em prisma.config.ts
// ("tsx prisma/seed.ts") como um processo filho, contando que `tsx` esteja no
// PATH. Quem normalmente coloca node_modules/.bin no PATH e o npx ou o npm -
// ao chamar o CLI direto pelo Node, isso nao acontece, e o seed falha com
// "tsx nao e reconhecido como um comando".
//
// Reproduzimos esse passo aqui para manter a invocacao sem shell.
const ambiente = {
  ...process.env,
  PATH: [
    path.join(process.cwd(), "node_modules", ".bin"),
    process.env.PATH ?? "",
  ].join(path.delimiter),
};

function executar(titulo, argumentos) {
  console.log(`[preparar-banco] ${titulo}...`);

  const resultado = spawnSync(process.execPath, [cliPrisma, ...argumentos], {
    stdio: "inherit",
    env: ambiente,
  });

  if (resultado.status !== 0) {
    console.error(
      `\n[preparar-banco] FALHOU em "${titulo}".\n` +
        "                 Verifique se DATABASE_URL aponta para um Postgres acessivel\n" +
        "                 e se o banco nao esta suspenso por inatividade.\n",
    );
    process.exit(resultado.status ?? 1);
  }
}

executar("aplicando migrations", ["migrate", "deploy"]);
executar("rodando seed", ["db", "seed"]);

console.log("[preparar-banco] banco pronto.");
