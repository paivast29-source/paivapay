/**
 * Manipulacao de valores monetarios.
 *
 * Secao 10, regra 6 da especificacao: todo valor monetario e armazenado e
 * calculado em CENTAVOS, usando inteiro. Nunca float ou double.
 *
 * O motivo e que 0.1 + 0.2 !== 0.3 em ponto flutuante. Em um sistema de
 * cobranca isso vira divergencia de centavos no relatorio e diferenca entre o
 * que foi cobrado e o que o PSP registrou.
 *
 * Toda funcao deste arquivo recebe e devolve centavos (Int). A conversao para
 * reais acontece apenas na formatacao para exibicao.
 */

/** Converte centavos em uma string no formato brasileiro: 123456 -> "R$ 1.234,56" */
export function formatarMoeda(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/** Como formatarMoeda, mas sem o simbolo: 123456 -> "1.234,56" */
export function formatarMoedaSemSimbolo(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

/**
 * Converte o que o usuario digitou no campo de valor para centavos.
 *
 * Aceita as formas que aparecem na pratica em um teclado brasileiro:
 *   "1.234,56" -> 123456
 *   "1234,56"  -> 123456
 *   "1234.56"  -> 123456
 *   "R$ 99,90" -> 9990
 *   "50"       -> 5000
 *
 * Devolve null quando a entrada nao representa um valor valido, para que o
 * chamador decida a mensagem de erro.
 */
export function paraCentavos(entrada: string | number): number | null {
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return null;
    return Math.round(entrada * 100);
  }

  const limpo = entrada.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (limpo === "") return null;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  let normalizado: string;

  if (temVirgula && temPonto) {
    // "1.234,56" - ponto e separador de milhar, virgula e decimal.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // "1234,56"
    normalizado = limpo.replace(",", ".");
  } else if (temPonto) {
    // Ambiguo: "1.234" pode ser milhar (1234) ou decimal (1.23).
    // Se houver exatamente dois digitos depois do ultimo ponto, tratamos como
    // decimal ("1234.56"); caso contrario, como separador de milhar ("1.234").
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1];
    normalizado =
      partes.length === 2 && ultima.length === 2
        ? limpo
        : limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;

  const valor = Number.parseFloat(normalizado);
  if (!Number.isFinite(valor)) return null;

  // Math.round evita o erro de representacao: 19.99 * 100 === 1998.9999...
  return Math.round(valor * 100);
}

/**
 * Soma os itens de uma cobranca, em centavos.
 * quantidade e valorUnitario sao inteiros, entao o produto e exato.
 */
export function somarItens(
  itens: { quantidade: number; valorUnitario: number }[],
): number {
  return itens.reduce(
    (total, item) => total + item.quantidade * item.valorUnitario,
    0,
  );
}

/** Converte centavos para o formato decimal que as APIs de PSP esperam (reais). */
export function centavosParaReais(centavos: number): number {
  return Number.parseFloat((centavos / 100).toFixed(2));
}

/** Converte reais devolvidos pelo PSP de volta para centavos. */
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}
