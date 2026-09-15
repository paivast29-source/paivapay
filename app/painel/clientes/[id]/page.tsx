import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoLink } from "@/components/ui/botao";
import { IconeMais } from "@/components/ui/icones";
import { BadgeStatus } from "@/components/ui/status-cobranca";
import { exigirUsuario } from "@/lib/auth/guarda";
import { statusExibicao } from "@/lib/cobrancas/status";
import { formatarData } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDocumento } from "@/lib/documento";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

/**
 * Ficha do cliente (secao 8.1).
 * "Na ficha do cliente, historico de todas as cobrancas dele."
 */
export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();

  const { id } = await params;

  const cliente = await db.cliente.findUnique({
    where: { id },
    include: {
      cobrancas: {
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          descricao: true,
          valorTotal: true,
          vencimento: true,
          status: true,
          criadoEm: true,
        },
      },
    },
  });

  if (!cliente) notFound();

  const totalPago = cliente.cobrancas
    .filter((cobranca) => cobranca.status === "pago")
    .reduce((soma, cobranca) => soma + cobranca.valorTotal, 0);

  const totalEmAberto = cliente.cobrancas
    .filter((cobranca) =>
      ["aguardando_pagamento", "vencido"].includes(cobranca.status),
    )
    .reduce((soma, cobranca) => soma + cobranca.valorTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/painel/clientes"
          className="text-sm text-secundario hover:text-grafite"
        >
          &larr; Clientes
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-grafite">
              {cliente.nome}
            </h1>
            <p className="mt-0.5 text-sm text-secundario">
              {cliente.tipo === "pf" ? "Pessoa fisica" : "Pessoa juridica"} -{" "}
              {formatarDocumento(cliente.documento)}
            </p>
          </div>

          <BotaoLink href={`/painel/cobrancas/nova?cliente=${cliente.id}`}>
            <IconeMais className="size-4" />
            Nova cobranca
          </BotaoLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="cartao p-4 md:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-grafite">Cadastro</h2>

          <dl className="flex flex-col gap-2.5 text-sm">
            <div>
              <dt className="text-xs text-secundario">E-mail</dt>
              <dd className="break-all text-grafite">{cliente.email}</dd>
            </div>

            {cliente.telefone ? (
              <div>
                <dt className="text-xs text-secundario">Telefone</dt>
                <dd className="text-grafite">{cliente.telefone}</dd>
              </div>
            ) : null}

            <div>
              <dt className="text-xs text-secundario">Cadastrado em</dt>
              <dd className="text-grafite">{formatarData(cliente.criadoEm)}</dd>
            </div>

            <div>
              <dt className="text-xs text-secundario">
                Consentimento de e-mail
              </dt>
              <dd className="text-grafite">
                {cliente.consentimentoEmail && cliente.consentimentoEmailEm
                  ? `Autorizado em ${formatarData(cliente.consentimentoEmailEm)}`
                  : "Nao autorizado"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2 border-t border-borda pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-secundario">Total pago</span>
              <span className="valor-monetario text-sm text-pago">
                {formatarMoeda(totalPago)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-secundario">Em aberto</span>
              <span className="valor-monetario text-sm text-grafite">
                {formatarMoeda(totalEmAberto)}
              </span>
            </div>
          </div>
        </div>

        <div className="cartao overflow-hidden md:col-span-2">
          <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-grafite">
            Historico de cobrancas
          </h2>

          {cliente.cobrancas.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-secundario">
              Nenhuma cobranca para este cliente ainda.
            </p>
          ) : (
            <ul className="divide-y divide-borda">
              {cliente.cobrancas.map((cobranca) => (
                <li key={cobranca.id}>
                  <Link
                    href={`/painel/cobrancas/${cobranca.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-fundo"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-grafite">
                        {cobranca.descricao}
                      </p>
                      <p className="text-xs text-secundario">
                        vence {formatarData(cobranca.vencimento)}
                      </p>
                    </div>

                    <span className="valor-monetario text-sm text-grafite">
                      {formatarMoeda(cobranca.valorTotal)}
                    </span>

                    <BadgeStatus
                      status={statusExibicao(cobranca)}
                      tamanho="pequeno"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
