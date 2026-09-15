import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, StatusCobranca } from "@prisma/client";
import { BotaoLink } from "@/components/ui/botao";
import { IconeBusca, IconeMais } from "@/components/ui/icones";
import { BadgeStatus } from "@/components/ui/status-cobranca";
import { exigirUsuario } from "@/lib/auth/guarda";
import { statusExibicao } from "@/lib/cobrancas/status";
import { formatarData, inicioDeHoje } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";

export const metadata: Metadata = { title: "Cobrancas" };
export const dynamic = "force-dynamic";

/**
 * Lista de cobrancas (secao 8.1).
 *
 * "Tabela com: cliente, descricao, valor, vencimento, status e acoes.
 *  Filtros por status, periodo e cliente. Busca por nome ou valor."
 *
 * Os filtros vao na querystring, e nao em estado de componente: o resultado
 * fica compartilhavel por link e sobrevive ao recarregar a pagina.
 */

const FILTROS_STATUS = [
  { valor: "", rotulo: "Todos" },
  { valor: "aguardando_pagamento", rotulo: "Aguardando" },
  { valor: "pago", rotulo: "Pagos" },
  { valor: "vencido", rotulo: "Vencidos" },
  { valor: "cancelado", rotulo: "Cancelados" },
  { valor: "rascunho", rotulo: "Rascunhos" },
] as const;

export default async function PaginaCobrancas({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; busca?: string }>;
}) {
  await exigirUsuario();

  const { status, busca } = await searchParams;
  const termo = busca?.trim() ?? "";
  const hoje = inicioDeHoje();

  const filtros: Prisma.CobrancaWhereInput[] = [];

  if (status === "vencido") {
    // "Vencido" precisa capturar tambem o que continua marcado como aguardando
    // mas ja passou do prazo - senao o filtro mostraria menos do que o cartao
    // do dashboard soma.
    filtros.push({
      OR: [
        { status: "vencido" },
        { status: "aguardando_pagamento", vencimento: { lt: hoje } },
      ],
    });
  } else if (status === "aguardando_pagamento") {
    filtros.push({ status: "aguardando_pagamento", vencimento: { gte: hoje } });
  } else if (status) {
    filtros.push({ status: status as StatusCobranca });
  }

  if (termo) {
    const comoCentavos = Number.parseInt(
      termo.replace(/[^\d]/g, "") || "0",
      10,
    );

    filtros.push({
      OR: [
        { descricao: { contains: termo, mode: "insensitive" } },
        { cliente: { nome: { contains: termo, mode: "insensitive" } } },
        // Busca por valor: "150" encontra R$ 150,00.
        ...(comoCentavos > 0 ? [{ valorTotal: comoCentavos * 100 }] : []),
      ],
    });
  }

  const cobrancas = await db.cobranca.findMany({
    where: filtros.length ? { AND: filtros } : undefined,
    orderBy: { criadoEm: "desc" },
    take: 100,
    select: {
      id: true,
      descricao: true,
      valorTotal: true,
      vencimento: true,
      status: true,
      cliente: { select: { nome: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-grafite">Cobrancas</h1>

        <BotaoLink href="/painel/cobrancas/nova">
          <IconeMais className="size-4" />
          Nova cobranca
        </BotaoLink>
      </div>

      <form method="get" className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secundario" />
          <input
            type="search"
            name="busca"
            defaultValue={termo}
            placeholder="Buscar por cliente, descricao ou valor"
            aria-label="Buscar cobrancas"
            className="h-[var(--altura-controle)] w-full rounded-md border border-borda bg-superficie pr-3 pl-9 text-sm text-grafite placeholder:text-secundario/60"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTROS_STATUS.map((filtro) => {
            const ativo = (status ?? "") === filtro.valor;
            return (
              <button
                key={filtro.valor}
                type="submit"
                name="status"
                value={filtro.valor}
                aria-pressed={ativo}
                className={`h-8 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors ${
                  ativo
                    ? "border-marca bg-marca-clara text-marca"
                    : "border-borda bg-superficie text-secundario hover:text-grafite"
                }`}
              >
                {filtro.rotulo}
              </button>
            );
          })}
        </div>
      </form>

      <div className="cartao overflow-hidden">
        {cobrancas.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-secundario">
            Nenhuma cobranca encontrada com esses filtros.
          </p>
        ) : (
          <>
            {/* Tabela no desktop */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-borda text-xs text-secundario">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Cliente
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Descricao
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Valor
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Vencimento
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-borda">
                {cobrancas.map((cobranca) => (
                  <tr
                    key={cobranca.id}
                    className="transition-colors hover:bg-fundo"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/painel/cobrancas/${cobranca.id}`}
                        className="font-medium text-grafite hover:text-marca"
                      >
                        {cobranca.cliente.nome}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 text-secundario">
                      {cobranca.descricao}
                    </td>
                    <td className="valor-monetario px-5 py-3 text-right text-grafite">
                      {formatarMoeda(cobranca.valorTotal)}
                    </td>
                    <td className="px-5 py-3 text-secundario">
                      {formatarData(cobranca.vencimento)}
                    </td>
                    <td className="px-5 py-3">
                      <BadgeStatus
                        status={statusExibicao(cobranca)}
                        tamanho="pequeno"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cartoes no celular: tabela de 5 colunas nao cabe em 400px. */}
            <ul className="divide-y divide-borda md:hidden">
              {cobrancas.map((cobranca) => (
                <li key={cobranca.id}>
                  <Link
                    href={`/painel/cobrancas/${cobranca.id}`}
                    className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-fundo"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-grafite">
                        {cobranca.cliente.nome}
                      </span>
                      <span className="valor-monetario text-sm text-grafite">
                        {formatarMoeda(cobranca.valorTotal)}
                      </span>
                    </div>

                    <p className="truncate text-xs text-secundario">
                      {cobranca.descricao}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <BadgeStatus
                        status={statusExibicao(cobranca)}
                        tamanho="pequeno"
                      />
                      <span className="text-xs text-secundario">
                        vence {formatarData(cobranca.vencimento)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
