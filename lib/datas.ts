/**
 * Utilitarios de data.
 *
 * O sistema trabalha no fuso de Sao Paulo. "Hoje" para efeito de vencimento
 * precisa ser o dia civil brasileiro, nao UTC - caso contrario, entre 21h e
 * meia-noite o servidor ja estaria no dia seguinte e marcaria como vencida uma
 * cobranca que ainda vence hoje.
 */

export const FUSO = "America/Sao_Paulo";

/** Meia-noite de hoje no fuso de Sao Paulo. */
export function inicioDeHoje(): Date {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);

  // "en-CA" devolve no formato YYYY-MM-DD.
  const [ano, mes, dia] = partes.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

export function inicioDoMes(referencia = new Date()): Date {
  return new Date(referencia.getFullYear(), referencia.getMonth(), 1);
}

export function fimDoMes(referencia = new Date()): Date {
  return new Date(
    referencia.getFullYear(),
    referencia.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

/** Soma dias a uma data, sem alterar a original. */
export function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/** Formata para exibicao: 15/09/2026 */
export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSO,
  }).format(data);
}

/** Formata com hora: 15/09/2026 as 14:32 */
export function formatarDataHora(data: Date): string {
  const formatada = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  }).format(data);

  return formatada.replace(", ", " as ");
}

/** Valor para <input type="date">: YYYY-MM-DD */
export function paraValorInputData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Le "YYYY-MM-DD" de um <input type="date"> como data local.
 *
 * new Date("2026-09-15") interpretaria a string como UTC e, no Brasil,
 * devolveria 14/09 as 21h. Por isso montamos componente a componente.
 */
export function deValorInputData(valor: string): Date | null {
  const partida = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partida) return null;

  const [, ano, mes, dia] = partida;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return Number.isNaN(data.getTime()) ? null : data;
}

const NOMES_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Os ultimos N meses, do mais antigo para o mais recente. */
export function ultimosMeses(quantidade: number): {
  chave: string;
  rotulo: string;
  inicio: Date;
  fim: Date;
}[] {
  const hoje = new Date();

  return Array.from({ length: quantidade }, (_, indice) => {
    const deslocamento = quantidade - 1 - indice;
    const referencia = new Date(
      hoje.getFullYear(),
      hoje.getMonth() - deslocamento,
      1,
    );

    return {
      chave: `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}`,
      rotulo: NOMES_MESES[referencia.getMonth()],
      inicio: inicioDoMes(referencia),
      fim: fimDoMes(referencia),
    };
  });
}
