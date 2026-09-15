import type { Metadata } from "next";
import Link from "next/link";
import { BotaoLink } from "@/components/ui/botao";
import { IconeBusca, IconeMais } from "@/components/ui/icones";
import { exigirUsuario } from "@/lib/auth/guarda";
import { db } from "@/lib/db";
import { formatarDocumento } from "@/lib/documento";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

/** Lista de clientes com busca (secao 8.1). */
export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  await exigirUsuario();

  const { busca } = await searchParams;
  const termo = busca?.trim() ?? "";

  const clientes = await db.cliente.findMany({
    where: termo
      ? {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { email: { contains: termo, mode: "insensitive" } },
            // O documento e gravado so com digitos, entao a busca tambem
            // precisa ignorar a pontuacao que a pessoa digitou.
            { documento: { contains: termo.replace(/[^0-9A-Za-z]/g, "") } },
          ],
        }
      : undefined,
    orderBy: { nome: "asc" },
    take: 100,
    select: {
      id: true,
      nome: true,
      tipo: true,
      documento: true,
      email: true,
      ativo: true,
      _count: { select: { cobrancas: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-grafite">Clientes</h1>

        <BotaoLink href="/painel/clientes/novo">
          <IconeMais className="size-4" />
          Novo cliente
        </BotaoLink>
      </div>

      {/* Busca por GET: o termo fica na URL, entao o resultado e compartilhavel
          e sobrevive ao recarregar a pagina. */}
      <form method="get" className="relative max-w-md">
        <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secundario" />
        <input
          type="search"
          name="busca"
          defaultValue={termo}
          placeholder="Buscar por nome, e-mail ou documento"
          aria-label="Buscar clientes"
          className="h-[var(--altura-controle)] w-full rounded-md border border-borda bg-superficie pr-3 pl-9 text-sm text-grafite placeholder:text-secundario/60"
        />
      </form>

      <div className="cartao overflow-hidden">
        {clientes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-secundario">
            {termo
              ? `Nenhum cliente encontrado para "${termo}".`
              : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {clientes.map((cliente) => (
              <li key={cliente.id}>
                <Link
                  href={`/painel/clientes/${cliente.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-fundo sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-grafite">
                      {cliente.nome}
                      {!cliente.ativo ? (
                        <span className="rounded-full border border-borda bg-fundo px-1.5 py-0.5 text-[10px] font-medium text-secundario">
                          Inativo
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-secundario">
                      {cliente.tipo === "pf" ? "CPF" : "CNPJ"}{" "}
                      {formatarDocumento(cliente.documento)} - {cliente.email}
                    </p>
                  </div>

                  <span className="text-xs text-secundario">
                    {cliente._count.cobrancas}{" "}
                    {cliente._count.cobrancas === 1 ? "cobranca" : "cobrancas"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {clientes.length === 100 ? (
        <p className="text-xs text-secundario">
          Mostrando os primeiros 100 resultados. Refine a busca para ver outros.
        </p>
      ) : null}
    </div>
  );
}
