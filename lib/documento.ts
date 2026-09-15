/**
 * Validacao e formatacao de CPF e CNPJ.
 *
 * O documento e gravado no banco somente com os caracteres significativos,
 * sem pontos, barra ou traco. A mascara existe apenas na exibicao.
 */

/** Remove tudo que nao for letra ou digito e passa para maiusculas. */
export function limparDocumento(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * Digito verificador pelo modulo 11.
 *
 * Vale tanto para CPF quanto para CNPJ. No CNPJ alfanumerico (ver validarCnpj)
 * o "valor" de cada caractere e o codigo ASCII menos 48, conforme a regra da
 * Receita Federal - por isso a funcao recebe numeros ja convertidos, e nao a
 * string crua.
 */
function digitoModulo11(valores: number[], pesos: number[]): number {
  const soma = valores.reduce((acc, v, i) => acc + v * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCpf(valor: string): boolean {
  const cpf = limparDocumento(valor);

  if (!/^\d{11}$/.test(cpf)) return false;

  // Sequencias repetidas (00000000000, 11111111111, ...) passam no calculo do
  // modulo 11 mas nao sao CPFs validos.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);

  const dv1 = digitoModulo11(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (dv1 !== digitos[9]) return false;

  const dv2 = digitoModulo11(
    digitos.slice(0, 10),
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return dv2 === digitos[10];
}

const PESOS_CNPJ_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Valida CNPJ numerico e tambem o CNPJ alfanumerico, que passou a ser emitido
 * a partir de 2026 (IN RFB 2.229/2024).
 *
 * No formato alfanumerico os 12 primeiros caracteres podem ser letras ou
 * digitos; os 2 ultimos, os verificadores, continuam sempre numericos. O
 * calculo e o mesmo modulo 11, usando (codigo ASCII - 48) como valor de cada
 * caractere - o que para '0'-'9' devolve 0-9 e mantem o resultado identico ao
 * do CNPJ antigo.
 */
export function validarCnpj(valor: string): boolean {
  const cnpj = limparDocumento(valor);

  if (cnpj.length !== 14) return false;

  // Os doze primeiros: letras ou digitos. Os dois ultimos: apenas digitos.
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj)) return false;

  // Sequencias repetidas nao sao validas.
  if (/^([0-9A-Z])\1{13}$/.test(cnpj)) return false;

  const valores = cnpj.split("").map((c) => c.charCodeAt(0) - 48);

  const dv1 = digitoModulo11(valores.slice(0, 12), PESOS_CNPJ_DV1);
  if (dv1 !== valores[12]) return false;

  const dv2 = digitoModulo11(valores.slice(0, 13), PESOS_CNPJ_DV2);
  return dv2 === valores[13];
}

/** Valida de acordo com o tipo de cliente. */
export function validarDocumento(valor: string, tipo: "pf" | "pj"): boolean {
  return tipo === "pf" ? validarCpf(valor) : validarCnpj(valor);
}

/** Aplica a mascara para exibicao. Entrada ja limpa ou nao. */
export function formatarDocumento(valor: string): string {
  const doc = limparDocumento(valor);

  if (doc.length === 11) {
    return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  if (doc.length === 14) {
    return doc.replace(
      /^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }

  return doc;
}
