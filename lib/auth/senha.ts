import { hash, verify } from "@node-rs/argon2";

/**
 * Hash de senha com argon2id (secao 11 da especificacao).
 *
 * Parametros seguem a recomendacao do OWASP para argon2id:
 * 19 MiB de memoria, 2 iteracoes, paralelismo 1.
 *
 * O custo de memoria e o que torna o ataque com GPU caro - diferente de
 * algoritmos que so gastam CPU.
 */
const OPCOES_ARGON2 = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES_ARGON2);
}

/**
 * Confere a senha contra o hash.
 *
 * Nunca deixa a excecao vazar: um hash corrompido ou em formato antigo deve
 * resultar em "senha invalida", nunca em erro 500 na tela de login.
 */
export async function conferirSenha(
  hashArmazenado: string,
  senha: string,
): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}

/**
 * Regras minimas de senha para usuarios do painel.
 * Devolve null quando esta ok, ou a mensagem de erro.
 */
export function validarForcaSenha(senha: string): string | null {
  if (senha.length < 8) {
    return "A senha precisa ter no minimo 8 caracteres.";
  }
  if (senha.length > 200) {
    // Limite superior evita que uma entrada enorme consuma CPU no hash.
    return "A senha e longa demais.";
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return "A senha precisa conter letras e numeros.";
  }
  return null;
}
