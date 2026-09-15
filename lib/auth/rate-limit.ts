import { db } from "@/lib/db";

/**
 * Rate limiting do login (secao 11 da especificacao: maximo de 5 tentativas,
 * bloqueio temporario).
 *
 * A contagem vive no banco, e nao em memoria, por dois motivos:
 *  - a aplicacao roda em ambiente serverless, onde cada requisicao pode cair
 *    em uma instancia diferente e memoria local nao e compartilhada;
 *  - um reinicio do processo nao pode zerar o bloqueio.
 */

const MAX_TENTATIVAS = 5;
const JANELA_MINUTOS = 15;

export type ResultadoRateLimit = {
  bloqueado: boolean;
  tentativasRestantes: number;
  /** Quando o bloqueio expira. Apenas quando bloqueado. */
  liberaEm?: Date;
};

function inicioDaJanela(): Date {
  return new Date(Date.now() - JANELA_MINUTOS * 60 * 1000);
}

/**
 * Verifica se a chave (e-mail normalizado ou IP) pode tentar novamente.
 * Conta apenas as tentativas que falharam dentro da janela.
 */
export async function verificarRateLimit(
  chave: string,
): Promise<ResultadoRateLimit> {
  const desde = inicioDaJanela();

  const tentativas = await db.tentativaLogin.findMany({
    where: { chave, sucesso: false, ocorridoEm: { gte: desde } },
    orderBy: { ocorridoEm: "asc" },
    select: { ocorridoEm: true },
  });

  if (tentativas.length >= MAX_TENTATIVAS) {
    // O bloqueio expira quando a tentativa mais antiga sair da janela.
    const maisAntiga = tentativas[0].ocorridoEm;
    return {
      bloqueado: true,
      tentativasRestantes: 0,
      liberaEm: new Date(maisAntiga.getTime() + JANELA_MINUTOS * 60 * 1000),
    };
  }

  return {
    bloqueado: false,
    tentativasRestantes: MAX_TENTATIVAS - tentativas.length,
  };
}

export async function registrarTentativa(
  chave: string,
  sucesso: boolean,
  ip?: string | null,
): Promise<void> {
  await db.tentativaLogin.create({
    data: { chave, sucesso, ip: ip ?? null },
  });
}

/**
 * Limpa o historico de falhas apos um login bem-sucedido, para que o usuario
 * legitimo nao carregue o contador da sessao anterior.
 */
export async function limparTentativas(chave: string): Promise<void> {
  await db.tentativaLogin.deleteMany({ where: { chave, sucesso: false } });
}

export const configuracaoRateLimit = {
  maxTentativas: MAX_TENTATIVAS,
  janelaMinutos: JANELA_MINUTOS,
};
