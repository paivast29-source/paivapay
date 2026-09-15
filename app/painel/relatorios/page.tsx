import type { Metadata } from "next";
import { IconeBaixar } from "@/components/ui/icones";
import { exigirDiretor } from "@/lib/auth/guarda";
import {
  formatarData,
  inicioDoMes,
  paraValorInputData,
  deValorInputData,
} from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";

export const metadata: Metadata = { title: "Relatorios" };
export const dynamic = "force-dynamic";

/**
 * Relatorio de recebimentos por periodo (secao 8.1).
 * "Recebimentos por periodo, com filtro de data e exportacao para CSV."
 *
 * Restrito a diretores (secao 6.1): o papel operacional nao acessa relatorios
 * consolidados.
 */
export default async function PaginaRelatorios({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  await exigirDiretor();

  const { de, ate } = await searchParams;

  // Padrao: mes corrente.
  const dataInicio = (de && deValorInputData(de)) || inicioDoMes();
  const dataFim = (ate && deValorInputData(ate)) || new Date();

  // Inclui o dia inteiro do limite superior.
  const fimDoDia = new Date(dataFim);
  fimDoDia.setHours(23, 59, 59, 999);

  const pagamentos = await db.cobranca.findMany({
    where: { status: "pago", pagoEm: { gte: dataInicio, lte: fimDoDia } },
    orderBy: { pagoEm: "desc" },
    select: {
      id: true,
      descricao: true,
      valorTotal: true,
      pagoEm: true,
      cliente: { select: { nome: true, documento: true } },
      transacoes: {
        where: { status: "confirmada" },
        select: { formaPagamento: true },
        take: 1,
      },
    },
  });

  const total = pagamentos.reduce((soma, p) => soma + p.valorTotal, 0);

  const parametrosCsv = new URLSearchParams({
    de: paraValorInputData(dataInicio),
    ate: paraValorInputData(dataFim),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-grafite">Relatorios</h1>
        <p className="mt-0.5 text-sm text-secundario">
          Recebimentos confirmados no periodo.
        </p>
      </div>

      <form
        method="get"
        className="cartao flex flex-wrap items-end gap-3 p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="de" className="text-sm font-medium text-grafite">
            De
          </label>
          <input
            id="de"
            type="date"
            name="de"
            defaultValue={paraValorInputData(dataInicio)}
            className="h-[var(--altura-controle)] rounded-md border border-borda bg-superficie px-3 text-sm text-grafite"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ate" className="text-sm font-medium text-grafite">
            Ate
          </label>
          <input
            id="ate"
            type="date"
            name="ate"
            defaultValue={paraValorInputData(dataFim)}
            className="h-[var(--altura-controle)] rounded-md border border-borda bg-superficie px-3 text-sm text-grafite"
          />
        </div>

        <button
          type="submit"
          className="h-[var(--altura-controle)] cursor-pointer rounded-md bg-marca px-4 text-sm font-medium text-superficie shadow-marca transition-colors hover:bg-marca-hover"
        >
          Filtrar
        </button>

        <a
          href={`/api/relatorios/csv?${parametrosCsv}`}
          className="inline-flex h-[var(--altura-controle)] items-center gap-2 rounded-md border border-borda bg-superficie px-4 text-sm font-medium text-grafite transition-colors hover:bg-fundo"
        >
          <IconeBaixar className="size-4" />
          Exportar CSV
        </a>
      </form>

      <div className="cartao flex flex-wrap items-baseline justify-between gap-3 p-4">
        <div>
          <p className="text-xs tracking-wide text-secundario uppercase">
            Total recebido
          </p>
          <p className="valor-monetario-destaque mt-1 text-2xl text-pago">
            {formatarMoeda(total)}
          </p>
        </div>

        <p className="text-sm text-secundario">
          {pagamentos.length}{" "}
          {pagamentos.length === 1 ? "pagamento" : "pagamentos"} entre{" "}
          {formatarData(dataInicio)} e {formatarData(dataFim)}
        </p>
      </div>

      <div className="cartao overflow-x-auto">
        {pagamentos.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-secundario">
            Nenhum recebimento neste periodo.
          </p>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-borda text-xs text-secundario">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Pago em
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Cliente
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Descricao
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Forma
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-borda">
              {pagamentos.map((pagamento) => (
                <tr key={pagamento.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-secundario">
                    {pagamento.pagoEm ? formatarData(pagamento.pagoEm) : "-"}
                  </td>
                  <td className="px-5 py-2.5 text-grafite">
                    {pagamento.cliente.nome}
                  </td>
                  <td className="max-w-xs truncate px-5 py-2.5 text-secundario">
                    {pagamento.descricao}
                  </td>
                  <td className="px-5 py-2.5 text-secundario capitalize">
                    {pagamento.transacoes[0]?.formaPagamento ?? "-"}
                  </td>
                  <td className="valor-monetario px-5 py-2.5 text-right text-grafite">
                    {formatarMoeda(pagamento.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
