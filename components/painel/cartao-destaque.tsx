import { formatarMoeda } from "@/lib/dinheiro";

/**
 * Cartao de destaque do topo do dashboard (secao 8.1).
 *
 * O acento de cor e uma faixa lateral, nunca o valor em si: numero colorido
 * disputa leitura com o status das cobrancas e, no caso do vermelho, fica
 * perto demais do rosa da marca (secao 3.2). O rotulo em texto e que diz o que
 * o numero significa.
 */

type Acento = "marca" | "pago" | "aguardando" | "vencido" | "neutro";

const ACENTOS: Record<Acento, string> = {
  marca: "bg-marca",
  pago: "bg-pago",
  aguardando: "bg-aguardando",
  vencido: "bg-vencido",
  neutro: "bg-borda",
};

export function CartaoDestaque({
  rotulo,
  valor,
  detalhe,
  acento = "neutro",
  monetario = true,
}: {
  rotulo: string;
  /** Em centavos quando monetario; caso contrario, o numero cru. */
  valor: number;
  detalhe?: string;
  acento?: Acento;
  monetario?: boolean;
}) {
  return (
    <div className="cartao relative overflow-hidden p-4">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${ACENTOS[acento]}`}
      />

      <p className="text-xs font-medium tracking-wide text-secundario uppercase">
        {rotulo}
      </p>

      <p className="valor-monetario-destaque mt-1.5 text-2xl text-grafite">
        {monetario ? formatarMoeda(valor) : valor.toLocaleString("pt-BR")}
      </p>

      {detalhe ? (
        <p className="mt-0.5 text-xs text-secundario">{detalhe}</p>
      ) : null}
    </div>
  );
}
