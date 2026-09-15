import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { TipoEventoCobranca } from "@prisma/client";
import { cancelarCobranca } from "@/app/painel/cobrancas/acoes";
import { simularPagamento } from "@/app/painel/cobrancas/[id]/acoes-dev";
import { Botao } from "@/components/ui/botao";
import { BotaoCopiar } from "@/components/ui/copiar";
import { BadgeStatus } from "@/components/ui/status-cobranca";
import { exigirUsuario } from "@/lib/auth/guarda";
import { podeCancelar, statusExibicao } from "@/lib/cobrancas/status";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDocumento } from "@/lib/documento";
import { usandoProviderMock } from "@/lib/psp";

export const metadata: Metadata = { title: "Detalhe da cobranca" };
export const dynamic = "force-dynamic";

const ROTULO_EVENTO: Record<TipoEventoCobranca, string> = {
  criada: "Cobranca criada",
  enviada: "E-mail enviado ao cliente",
  visualizada: "Link de pagamento aberto pelo cliente",
  paga: "Pagamento confirmado",
  vencida: "Cobranca vencida",
  cancelada: "Cobranca cancelada",
  estornada: "Pagamento estornado",
  lembrete_enviado: "Lembrete enviado",
  recibo_enviado: "Recibo enviado",
};

/**
 * Detalhe da cobranca (secao 8.1).
 * "Todos os dados, historico completo de eventos (criada, enviada,
 *  visualizada, paga), link de pagamento e botoes de acao."
 */
export default async function PaginaDetalheCobranca({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string }>;
}) {
  await exigirUsuario();

  const { id } = await params;
  const { criada } = await searchParams;

  const cobranca = await db.cobranca.findUnique({
    where: { id },
    include: {
      cliente: true,
      itens: true,
      eventos: { orderBy: { criadoEm: "desc" } },
      transacoes: { orderBy: { criadoEm: "desc" } },
      contaRecebedora: { select: { nome: true } },
      criador: { select: { nome: true } },
    },
  });

  if (!cobranca) notFound();

  const statusAtual = statusExibicao(cobranca);
  const urlBase = process.env.APP_URL || "http://localhost:3000";
  const linkPagamento = `${urlBase}/pagar/${cobranca.tokenPublico}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/painel/cobrancas"
          className="text-sm text-secundario hover:text-grafite"
        >
          &larr; Cobrancas
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-grafite">
              {cobranca.descricao}
            </h1>
            <p className="mt-0.5 text-sm text-secundario">
              <Link
                href={`/painel/clientes/${cobranca.cliente.id}`}
                className="hover:text-marca"
              >
                {cobranca.cliente.nome}
              </Link>{" "}
              - {formatarDocumento(cobranca.cliente.documento)}
            </p>
          </div>

          <BadgeStatus status={statusAtual} />
        </div>
      </div>

      {criada ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-pago/30 bg-pago-fundo px-3 py-2.5 text-sm text-pago"
        >
          <span aria-hidden="true" className="font-bold">
            &#10003;
          </span>
          <span>
            Cobranca criada. Envie o link abaixo ao cliente por e-mail ou
            WhatsApp.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* ---- Itens ---------------------------------------------------- */}
          <section className="cartao overflow-hidden">
            <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-grafite sm:px-5">
              Itens
            </h2>

            <table className="w-full text-left text-sm">
              <thead className="border-b border-borda text-xs text-secundario">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium sm:px-5">
                    Descricao
                  </th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">
                    Qtd.
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Unitario
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right font-medium sm:px-5"
                  >
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-borda">
                {cobranca.itens.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 text-grafite sm:px-5">
                      {item.descricao}
                    </td>
                    <td className="valor-monetario px-2 py-2.5 text-center text-secundario">
                      {item.quantidade}
                    </td>
                    <td className="valor-monetario px-2 py-2.5 text-right text-secundario">
                      {formatarMoeda(item.valorUnitario)}
                    </td>
                    <td className="valor-monetario px-4 py-2.5 text-right text-grafite sm:px-5">
                      {formatarMoeda(item.valorTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-borda">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-sm font-medium text-grafite sm:px-5"
                  >
                    Total
                  </td>
                  <td className="valor-monetario-destaque px-4 py-3 text-right text-base text-grafite sm:px-5">
                    {formatarMoeda(cobranca.valorTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ---- Historico de eventos ------------------------------------- */}
          <section className="cartao overflow-hidden">
            <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-grafite sm:px-5">
              Historico
            </h2>

            <ol className="divide-y divide-borda">
              {cobranca.eventos.map((evento) => (
                <li
                  key={evento.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-grafite">
                      {ROTULO_EVENTO[evento.tipo]}
                    </p>
                    {evento.descricao ? (
                      <p className="text-xs text-secundario">
                        {evento.descricao}
                      </p>
                    ) : null}
                  </div>

                  <time
                    dateTime={evento.criadoEm.toISOString()}
                    className="text-xs whitespace-nowrap text-secundario"
                  >
                    {formatarDataHora(evento.criadoEm)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ---- Coluna lateral ---------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <section className="cartao p-4">
            <h2 className="mb-3 text-sm font-semibold text-grafite">
              Link de pagamento
            </h2>

            <p className="mb-2 rounded-md border border-borda bg-fundo px-2.5 py-2 text-xs break-all text-secundario">
              {linkPagamento}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <BotaoCopiar texto={linkPagamento} rotulo="Copiar link" />
              <a
                href={linkPagamento}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-marca hover:bg-marca-clara"
              >
                Abrir
              </a>
            </div>
          </section>

          <section className="cartao p-4">
            <h2 className="mb-3 text-sm font-semibold text-grafite">Dados</h2>

            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-secundario">Vencimento</dt>
                <dd className="text-grafite">
                  {formatarData(cobranca.vencimento)}
                </dd>
              </div>

              <div className="flex justify-between gap-3">
                <dt className="text-secundario">Formas aceitas</dt>
                <dd className="text-right text-grafite capitalize">
                  {cobranca.formasPagamentoAceitas.join(", ")}
                </dd>
              </div>

              <div className="flex justify-between gap-3">
                <dt className="text-secundario">Criada em</dt>
                <dd className="text-grafite">
                  {formatarData(cobranca.criadoEm)}
                </dd>
              </div>

              {cobranca.criador ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-secundario">Criada por</dt>
                  <dd className="text-right text-grafite">
                    {cobranca.criador.nome}
                  </dd>
                </div>
              ) : null}

              {cobranca.pagoEm ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-secundario">Pago em</dt>
                  <dd className="text-right text-pago">
                    {formatarDataHora(cobranca.pagoEm)}
                  </dd>
                </div>
              ) : null}

              {/* Secao 4.3: a conta recebedora aparece desde a v1, ainda que
                  hoje seja sempre a mesma. */}
              <div className="flex justify-between gap-3 border-t border-borda pt-2.5">
                <dt className="text-secundario">Conta recebedora</dt>
                <dd className="text-right text-grafite">
                  {cobranca.contaRecebedora.nome}
                </dd>
              </div>
            </dl>
          </section>

          {podeCancelar(cobranca.status) ? (
            <section className="cartao p-4">
              <h2 className="mb-1 text-sm font-semibold text-grafite">Acoes</h2>
              <p className="mb-3 text-xs text-secundario">
                Cancelar invalida o link de pagamento. Cobranca ja paga nao pode
                ser cancelada.
              </p>

              <form action={cancelarCobranca}>
                <input type="hidden" name="cobrancaId" value={cobranca.id} />
                <Botao type="submit" variante="perigo" tamanho="pequeno">
                  Cancelar cobranca
                </Botao>
              </form>
            </section>
          ) : null}

          {/* ---- Bloco exclusivo de desenvolvimento ------------------------ */}
          {usandoProviderMock() && cobranca.status === "aguardando_pagamento" ? (
            <section className="rounded-lg border border-dashed border-aguardando/50 bg-aguardando-fundo p-4">
              <h2 className="mb-1 text-sm font-semibold text-grafite">
                Desenvolvimento
              </h2>
              <p className="mb-3 text-xs text-secundario">
                Dispara um webhook real no formato do PSP, exercitando validacao
                de assinatura, idempotencia e atualizacao de status. Este bloco
                nao existe em producao.
              </p>

              <form action={simularPagamento}>
                <input type="hidden" name="cobrancaId" value={cobranca.id} />
                <Botao type="submit" variante="secundario" tamanho="pequeno">
                  Simular pagamento
                </Botao>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
