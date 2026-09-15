import type { StatusCobranca } from "@prisma/client";
import { APRESENTACAO_STATUS } from "@/lib/cobrancas/status";
import {
  IconeAlerta,
  IconeCheck,
  IconeProibido,
  IconeRascunho,
  IconeRelogio,
  IconeVoltar,
} from "@/components/ui/icones";

/**
 * Badge de status da cobranca.
 *
 * Secao 3.2 da especificacao:
 *
 *   "o vermelho de erro (#DC2626) e o rosa da marca (#EF4176) sao proximos.
 *    Nenhum status pode ser comunicado so por cor - todo status precisa de
 *    icone + texto junto."
 *
 * Este componente e o que torna essa regra estrutural em vez de uma lembranca:
 * nao existe prop que permita esconder o texto ou o icone. Qualquer tela que
 * precise exibir status usa este componente, e a regra fica atendida por
 * construcao - inclusive para usuarios daltonicos.
 */

const ICONES = {
  relogio: IconeRelogio,
  check: IconeCheck,
  alerta: IconeAlerta,
  proibido: IconeProibido,
  rascunho: IconeRascunho,
  voltar: IconeVoltar,
} as const;

export function BadgeStatus({
  status,
  tamanho = "normal",
}: {
  status: StatusCobranca;
  tamanho?: "normal" | "pequeno";
}) {
  const apresentacao = APRESENTACAO_STATUS[status];
  const Icone = ICONES[apresentacao.icone];

  const classesTamanho =
    tamanho === "pequeno"
      ? "px-2 py-0.5 text-xs gap-1"
      : "px-2.5 py-1 text-sm gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${apresentacao.classe} ${classesTamanho}`}
    >
      <Icone className={tamanho === "pequeno" ? "size-3" : "size-3.5"} />
      {apresentacao.rotulo}
    </span>
  );
}
