import type { StatusCobranca } from "@prisma/client";

/**
 * Apresentacao dos status de cobranca.
 *
 * Secao 3.2 da especificacao: o vermelho de erro (#DC2626) e o rosa da marca
 * (#EF4176) sao proximos. Nenhum status pode ser comunicado somente por cor -
 * todo status carrega icone + texto. Por isso cada entrada deste mapa define
 * rotulo e icone, e nao apenas a classe de cor.
 */

export type ApresentacaoStatus = {
  rotulo: string;
  /** Nome do icone em components/ui/icones.tsx */
  icone: "relogio" | "check" | "alerta" | "proibido" | "rascunho" | "voltar";
  classe: string;
};

export const APRESENTACAO_STATUS: Record<StatusCobranca, ApresentacaoStatus> = {
  rascunho: {
    rotulo: "Rascunho",
    icone: "rascunho",
    classe: "bg-fundo text-secundario border-borda",
  },
  aguardando_pagamento: {
    rotulo: "Aguardando pagamento",
    icone: "relogio",
    classe: "bg-aguardando-fundo text-aguardando border-aguardando/30",
  },
  pago: {
    rotulo: "Pago",
    icone: "check",
    classe: "bg-pago-fundo text-pago border-pago/30",
  },
  vencido: {
    rotulo: "Vencido",
    icone: "alerta",
    classe: "bg-vencido-fundo text-vencido border-vencido/30",
  },
  cancelado: {
    rotulo: "Cancelado",
    icone: "proibido",
    classe: "bg-fundo text-secundario border-borda",
  },
  estornado: {
    rotulo: "Estornado",
    icone: "voltar",
    classe: "bg-fundo text-secundario border-borda",
  },
};

/**
 * Status para exibicao.
 *
 * Uma cobranca em aguardando_pagamento cujo vencimento ja passou deve aparecer
 * como vencida mesmo antes de a rotina diaria rodar - caso contrario o painel
 * mostra "aguardando" para algo que venceu semana passada.
 *
 * Isto e apenas apresentacao. O status gravado so muda por webhook, consulta ao
 * PSP ou rotina de vencimento; nunca a partir desta funcao.
 */
export function statusExibicao(cobranca: {
  status: StatusCobranca;
  vencimento: Date;
}): StatusCobranca {
  if (cobranca.status !== "aguardando_pagamento") return cobranca.status;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencimento = new Date(cobranca.vencimento);
  vencimento.setHours(0, 0, 0, 0);

  return vencimento < hoje ? "vencido" : "aguardando_pagamento";
}

/** Status considerados "em aberto" para efeito de cobranca e lembrete. */
export const STATUS_EM_ABERTO: StatusCobranca[] = [
  "aguardando_pagamento",
  "vencido",
];

/**
 * Secao 10, regra 9: cobranca paga e imutavel.
 * Depois de paga, nao pode ter valor, itens ou cliente alterados. Correcao so
 * via cancelamento com estorno e emissao de nova cobranca.
 */
export function podeEditar(status: StatusCobranca): boolean {
  return status === "rascunho" || status === "aguardando_pagamento";
}

export function podeCancelar(status: StatusCobranca): boolean {
  return status === "rascunho" || status === "aguardando_pagamento" || status === "vencido";
}
