import { sair } from "@/app/entrar/acoes";
import { Navegacao } from "@/components/painel/navegacao";
import { IconeSair } from "@/components/ui/icones";
import { Logo } from "@/components/ui/logo";
import { exigirUsuario } from "@/lib/auth/guarda";

/**
 * Shell do painel administrativo.
 *
 * exigirUsuario() roda aqui, entao nenhuma rota sob /painel e acessivel sem
 * sessao valida. Cada pagina com restricao adicional (relatorios,
 * configuracoes) chama exigirDiretor() por conta propria - o layout garante
 * autenticacao, nao autorizacao.
 */
export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  const ehDiretor = usuario.papel === "diretor";

  return (
    <div className="min-h-dvh bg-fundo">
      {/* Cabecalho: no celular vira a unica barra; no desktop acompanha a lateral. */}
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo className="text-xl" />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-grafite">{usuario.nome}</p>
              <p className="text-xs text-secundario">
                {ehDiretor ? "Diretor" : "Operacional"}
              </p>
            </div>

            <form action={sair}>
              <button
                type="submit"
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-secundario transition-colors hover:bg-fundo hover:text-grafite"
              >
                <IconeSair className="size-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-22">
            <Navegacao ehDiretor={ehDiretor} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Navegacao no celular: barra fixa no rodape, alvo de toque confortavel. */}
      <div className="sticky bottom-0 z-20 border-t border-borda bg-superficie p-2 md:hidden">
        <Navegacao ehDiretor={ehDiretor} orientacao="horizontal" />
      </div>
    </div>
  );
}
