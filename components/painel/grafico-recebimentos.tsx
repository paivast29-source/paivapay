import { formatarMoeda } from "@/lib/dinheiro";

/**
 * Grafico de recebimentos dos ultimos 6 meses (secao 8.1, Dashboard).
 *
 * Decisoes de visualizacao:
 *
 *  - Barras, e nao linha: sao seis totais mensais fechados, valores discretos.
 *    Linha sugeriria continuidade entre os meses, que nao existe.
 *
 *  - Serie unica, na cor da marca. Sem legenda - o titulo ja nomeia a serie.
 *
 *  - Rotulo direto so na maior barra. Numero em cima de toda barra polui e
 *    disputa atencao com os quatro cartoes de destaque logo acima.
 *
 *  - Grade recessiva: uma unica linha de base, sem grade horizontal completa.
 *
 *  - Sem JavaScript. O hover e feito em CSS puro e a tabela equivalente esta no
 *    DOM para leitores de tela. Renderiza no servidor, nao custa bundle.
 */

export type MesRecebimento = {
  /** "2026-09" */
  chave: string;
  /** "set" */
  rotulo: string;
  /** EM CENTAVOS. */
  total: number;
};

export function GraficoRecebimentos({ meses }: { meses: MesRecebimento[] }) {
  const maior = Math.max(...meses.map((m) => m.total), 1);
  const totalPeriodo = meses.reduce((soma, m) => soma + m.total, 0);

  if (totalPeriodo === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-borda text-sm text-secundario">
        Nenhum recebimento nos ultimos 6 meses.
      </div>
    );
  }

  return (
    <figure className="m-0">
      {/* gap-0.5 = 2px entre barras, conforme o espacador padrao. */}
      <div className="flex h-48 items-end justify-between gap-0.5">
        {meses.map((mes) => {
          const alturaPct = (mes.total / maior) * 100;
          const ehMaior = mes.total === maior && mes.total > 0;

          return (
            <div
              key={mes.chave}
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              {/* Tooltip em CSS puro. aria-hidden porque a tabela abaixo ja
                  entrega o mesmo conteudo ao leitor de tela. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 scale-95 rounded-md border border-borda bg-superficie px-2 py-1 whitespace-nowrap opacity-0 shadow-elevado transition-all group-hover:scale-100 group-hover:opacity-100"
              >
                <span className="valor-monetario text-xs text-grafite">
                  {formatarMoeda(mes.total)}
                </span>
              </div>

              {ehMaior ? (
                <span
                  aria-hidden="true"
                  className="valor-monetario mb-1 text-center text-[10px] text-secundario group-hover:opacity-0"
                >
                  {formatarMoeda(mes.total)}
                </span>
              ) : null}

              {/* Marca fina, ancorada na linha de base, com topo arredondado. */}
              <div
                className="w-full rounded-t-[4px] bg-marca transition-opacity group-hover:opacity-80"
                style={{
                  height: `${Math.max(alturaPct, mes.total > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Linha de base unica - sem grade horizontal. */}
      <div className="h-px w-full bg-borda" />

      <div className="mt-2 flex justify-between gap-0.5">
        {meses.map((mes) => (
          <span
            key={mes.chave}
            aria-hidden="true"
            className="flex-1 text-center text-xs text-secundario"
          >
            {mes.rotulo}
          </span>
        ))}
      </div>

      {/* Equivalente textual: identidade e valor nunca dependem so da cor. */}
      <figcaption className="sr-only">
        <table>
          <caption>Recebimentos dos ultimos 6 meses</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Total recebido</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((mes) => (
              <tr key={mes.chave}>
                <th scope="row">{mes.chave}</th>
                <td>{formatarMoeda(mes.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
