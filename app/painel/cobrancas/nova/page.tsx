import type { Metadata } from "next";
import Link from "next/link";
import { FormularioCobranca } from "@/app/painel/cobrancas/nova/formulario";
import { BotaoLink } from "@/components/ui/botao";
import { exigirUsuario } from "@/lib/auth/guarda";
import { paraValorInputData, somarDias } from "@/lib/datas";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nova cobranca" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaCobranca({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  await exigirUsuario();

  const { cliente } = await searchParams;

  const clientes = await db.cliente.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  if (clientes.length === 0) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <h1 className="text-xl font-semibold text-grafite">Nova cobranca</h1>

        <div className="cartao p-6 text-center">
          <p className="text-sm text-secundario">
            Para emitir uma cobranca e preciso ter ao menos um cliente
            cadastrado.
          </p>
          <div className="mt-4 flex justify-center">
            <BotaoLink href="/painel/clientes/novo">
              Cadastrar primeiro cliente
            </BotaoLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <Link
          href="/painel/cobrancas"
          className="text-sm text-secundario hover:text-grafite"
        >
          &larr; Cobrancas
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-grafite">
          Nova cobranca
        </h1>
        <p className="mt-0.5 text-sm text-secundario">
          O cliente recebe um link de pagamento com a marca PaivaPay.
        </p>
      </div>

      <FormularioCobranca
        clientes={clientes}
        clienteInicial={cliente}
        // Vencimento sugerido: 7 dias, prazo usual de uma cobranca avulsa.
        vencimentoPadrao={paraValorInputData(somarDias(new Date(), 7))}
      />
    </div>
  );
}
