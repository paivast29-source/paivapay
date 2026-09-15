import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Geracao de tokens.
 *
 * Secao 10, regra 5 da especificacao: o token da URL publica de pagamento tem
 * no minimo 32 caracteres e e gerado por funcao criptograficamente segura.
 *
 * Nunca usar id sequencial na URL publica. Com /pagar/1, /pagar/2, qualquer
 * pessoa navegaria pelas cobrancas dos outros clientes apenas trocando o
 * numero.
 */

/** 48 bytes -> 64 caracteres em base64url. Bem acima do minimo de 32. */
const BYTES_TOKEN_PUBLICO = 48;

/** 32 bytes -> ~43 caracteres. Token de sessao do painel. */
const BYTES_TOKEN_SESSAO = 32;

function aleatorioBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/** Token da URL publica de pagamento (/pagar/<token>). */
export function gerarTokenPublico(): string {
  return aleatorioBase64Url(BYTES_TOKEN_PUBLICO);
}

/** Token de sessao do painel administrativo. */
export function gerarTokenSessao(): string {
  return aleatorioBase64Url(BYTES_TOKEN_SESSAO);
}

/**
 * Hash do token de sessao, para guardar no banco.
 *
 * O cookie do navegador carrega o token em claro; o banco guarda apenas este
 * hash. Assim um vazamento do banco nao permite personificar usuarios.
 *
 * SHA-256 sem salt e adequado aqui - diferente de senha - porque o token ja e
 * aleatorio de 256 bits, o que torna busca por forca bruta e rainbow table
 * inviaveis.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Comparacao em tempo constante.
 *
 * Usada na validacao do token de webhook. Um `===` comum sai no primeiro
 * caractere diferente, e a diferenca de tempo permite que um atacante descubra
 * o segredo caractere a caractere.
 */
export function compararSegredos(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // timingSafeEqual exige buffers do mesmo tamanho. Comparar os tamanhos antes
  // vaza apenas o comprimento do segredo, o que nao e util para o atacante.
  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}
