"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconeClientes,
  IconeCobrancas,
  IconeConfiguracoes,
  IconePainel,
  IconeRelatorios,
} from "@/components/ui/icones";

/**
 * Navegacao lateral do painel.
 *
 * Client component apenas por causa do usePathname, usado para destacar o item
 * ativo.
 *
 * IMPORTANTE: esconder um item aqui NAO e controle de acesso. As telas
 * restritas a diretores chamam exigirDiretor() no servidor
 * (lib/auth/guarda.ts). Este filtro serve so para nao mostrar um caminho que
 * levaria a um redirecionamento.
 */

const ITENS = [
  { href: "/painel", rotulo: "Dashboard", Icone: IconePainel, exato: true },
  { href: "/painel/cobrancas", rotulo: "Cobrancas", Icone: IconeCobrancas },
  { href: "/painel/clientes", rotulo: "Clientes", Icone: IconeClientes },
  {
    href: "/painel/relatorios",
    rotulo: "Relatorios",
    Icone: IconeRelatorios,
    somenteDiretor: true,
  },
  {
    href: "/painel/configuracoes",
    rotulo: "Configuracoes",
    Icone: IconeConfiguracoes,
    somenteDiretor: true,
  },
] as const;

type PropsNavegacao = {
  ehDiretor: boolean;
  /**
   * vertical   - barra lateral do desktop
   * horizontal - barra fixa no rodape do celular, com icone acima do rotulo
   */
  orientacao?: "vertical" | "horizontal";
};

export function Navegacao({
  ehDiretor,
  orientacao = "vertical",
}: PropsNavegacao) {
  const caminho = usePathname();
  const horizontal = orientacao === "horizontal";

  const itensVisiveis = ITENS.filter(
    (item) => !("somenteDiretor" in item && item.somenteDiretor) || ehDiretor,
  );

  return (
    <nav
      aria-label="Navegacao principal"
      className={
        horizontal
          ? "flex items-stretch justify-around gap-1"
          : "flex flex-col gap-0.5"
      }
    >
      {itensVisiveis.map(({ href, rotulo, Icone, ...resto }) => {
        const exato = "exato" in resto && resto.exato;
        const ativo = exato ? caminho === href : caminho.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={[
              "flex rounded-md font-medium transition-colors",
              horizontal
                ? "flex-1 flex-col items-center gap-1 px-1 py-1.5 text-[11px]"
                : "items-center gap-2.5 px-3 py-2 text-sm",
              ativo
                ? "bg-marca-clara text-marca"
                : "text-secundario hover:bg-fundo hover:text-grafite",
            ].join(" ")}
          >
            <Icone className="size-5 shrink-0" />
            <span className={horizontal ? "leading-none" : ""}>{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
