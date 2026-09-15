import type { Metadata } from "next";
import Link from "next/link";
import { CartaoDestaque } from "@/components/painel/cartao-destaque";
import { GraficoRecebimentos } from "@/components/painel/grafico-recebimentos";
import { BotaoLink } from "@/components/ui/botao";
import { IconeMais, IconeSeta } from "@/components/ui/icones";
import { BadgeStatus } from "@/components/ui/status-cobranca";
import { exigirUsuario } from "@/lib/auth/guarda";
import { statusExibicao } from "@/lib/cobrancas/status";
import { fimDoMes, formatarData, inicioDeHoje, inicioDoMes, ultimosMeses } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";

export const metadata: Metadata = { title: "Dashboard" };

// Painel financeiro nao pode ser servido de cache: os numeros mudam a cada
// webhook recebido.
export const dynamic = "force-dynamic";

/**
 * Dashboard (secao 8.1 da especificacao).
 *
 * "Quatro cartoes no topo: recebido no mes, a receber, vencido, total de
 *  clientes ativos. Abaixo, lista das 10 cobrancas mais recentes e um grafico
 *  simples de recebimentos dos ultimos 6 meses."
 */
export default async function PaginaDashboard() {
  await exigirUsuario();

  const hoje = inicioDeHoje();
  const mesAtual = { inicio: inicioDoMes(), fim: fimDoMes() };
  const meses = ultimosMeses(6);

  // Todas as consultas em paralelo: sao independentes entre si.
  const [
    recebidoNoMes,
    aReceber,
    vencido,
    clientesAtivos,
    recentes,
    pagamentosDoPeriodo,
  ] = await Promise.all([
    db.cobranca.aggregate({
      _sum: { valorTotal: true },
      where: {
        status: "pago",
        pagoEm: { gte: mesAtual.inicio, lte: mesAtual.fim },
      },
    }),

    // A receber: em aberto e ainda dentro do prazo.
    db.cobranca.aggregate({
      _sum: { valorTotal: true },
      where: { status: "aguardando_pagamento", vencimento: { gte: hoje } },
    }),

    // Vencido: inclui tanto o que a rotina diaria ja marcou como vencido quanto
    // o que ainda esta como aguardando mas cujo vencimento ja passou. Sem a
    // segunda parte, o cartao mostraria zero ate a rotina rodar de madrugada.
    db.cobranca.aggregate({
      _sum: { valorTotal: true },
      where: {
        OR: [
          { status: "vencido" },
          { status: "aguardando_pagamento", vencimento: { lt: hoje } },
        ],
      },
    }),

    db.cliente.count({ where: { ativo: true } }),

    db.cobranca.findMany({
      where: { status: { not: "rascunho" } },
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: {
        id: true,
        descricao: true,
        valorTotal: true,
        vencimento: true,
        status: true,
        cliente: { select: { nome: true } },
      },
    }),

    // Uma unica consulta cobrindo os 6 meses; o agrupamento por mes e feito
    // abaixo, em memoria. Seis consultas separadas seriam seis idas ao banco
    // para somar algumas dezenas de linhas.
    db.cobranca.findMany({
      where: {
        status: "pago",
        pagoEm: { gte: meses[0].inicio, lte: meses[meses.length - 1].fim },
      },
      select: { valorTotal: true, pagoEm: true },
    }),
  ]);

  const totaisPorMes = meses.map((mes) => ({
    chave: mes.chave,
    rotulo: mes.rotulo,
    total: pagamentosDoPeriodo
      .filter(
        (pagamento) =>
          pagamento.pagoEm &&
          pagamento.pagoEm >= mes.inicio &&
          pagamento.pagoEm <= mes.fim,
      )
      .reduce((soma, pagamento) => soma + pagamento.valorTotal, 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-grafite">Dashboard</h1>

        <BotaoLink href="/painel/cobrancas/nova">
          <IconeMais className="size-4" />
          Nova cobranca
        </BotaoLink>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoDestaque
          rotulo="Recebido no mes"
          valor={recebidoNoMes._sum.valorTotal ?? 0}
          acento="pago"
          detalhe={`${formatarData(mesAtual.inicio)} ate hoje`}
        />
        <CartaoDestaque
          rotulo="A receber"
          valor={aReceber._sum.valorTotal ?? 0}
          acento="aguardando"
          detalhe="Em aberto, dentro do prazo"
        />
        <CartaoDestaque
          rotulo="Vencido"
          valor={vencido._sum.valorTotal ?? 0}
          acento="vencido"
          detalhe="Em aberto, prazo ultrapassado"
        />
        <CartaoDestaque
          rotulo="Clientes ativos"
          valor={clientesAtivos}
          monetario={false}
          acento="marca"
        />
      </div>

      <section className="cartao p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-grafite">
          Recebimentos dos ultimos 6 meses
        </h2>
        <GraficoRecebimentos meses={totaisPorMes} />
      </section>

      <section className="cartao overflow-hidden">
        <div className="flex items-center justify-between border-b border-borda px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-grafite">
            Cobrancas mais recentes
          </h2>
          <Link
            href="/painel/cobrancas"
            className="flex items-center gap-1 text-sm font-medium text-marca hover:text-marca-hover"
          >
            Ver todas
            <IconeSeta className="size-3.5" />
          </Link>
        </div>

        {recentes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-secundario sm:px-5">
            Nenhuma cobranca ainda.{" "}
            <Link
              href="/painel/cobrancas/nova"
              className="font-medium text-marca hover:text-marca-hover"
            >
              Criar a primeira
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {recentes.map((cobranca) => (
              <li key={cobranca.id}>
                <Link
                  href={`/painel/cobrancas/${cobranca.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-fundo sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-grafite">
                      {cobranca.cliente.nome}
                    </p>
                    <p className="truncate text-xs text-secundario">
                      {cobranca.descricao}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="valor-monetario text-sm text-grafite">
                      {formatarMoeda(cobranca.valorTotal)}
                    </p>
                    <p className="text-xs text-secundario">
                      vence {formatarData(cobranca.vencimento)}
                    </p>
                  </div>

                  <BadgeStatus
                    status={statusExibicao(cobranca)}
                    tamanho="pequeno"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
