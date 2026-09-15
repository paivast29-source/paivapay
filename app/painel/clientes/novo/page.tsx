import type { Metadata } from "next";
import { FormularioCliente } from "@/app/painel/clientes/novo/formulario";
import { exigirUsuario } from "@/lib/auth/guarda";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function PaginaNovoCliente() {
  await exigirUsuario();

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-grafite">Novo cliente</h1>
        <p className="mt-0.5 text-sm text-secundario">
          Cadastre pessoa fisica ou juridica para poder emitir cobrancas.
        </p>
      </div>

      <div className="cartao p-4 sm:p-5">
        <FormularioCliente />
      </div>
    </div>
  );
}
