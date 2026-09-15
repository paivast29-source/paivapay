import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioEntrada } from "@/app/entrar/formulario";
import { Logo } from "@/components/ui/logo";
import { obterUsuarioSessao } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Tela de login (secao 8.1 da especificacao).
 * "Logo, campos de e-mail e senha, link de recuperacao de senha.
 *  Fundo off-white, card central branco."
 */
export default async function PaginaEntrar() {
  // Quem ja esta autenticado nao precisa ver o login.
  if (await obterUsuarioSessao()) redirect("/painel");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fundo px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Logo className="text-3xl" />
        </div>

        <div className="cartao p-6 sm:p-7">
          <h1 className="mb-1 text-lg font-semibold text-grafite">
            Entrar no painel
          </h1>
          <p className="mb-6 text-sm text-secundario">
            Acesso restrito a equipe da Paiva Studio.
          </p>

          <FormularioEntrada />
        </div>

        <p className="mt-5 text-center text-sm text-secundario">
          Esqueceu a senha?{" "}
          {/*
            Recuperacao de senha por e-mail entra na Fase 2, junto com o
            provedor de e-mail transacional (secao 12). Ate la, a redefinicao e
            feita por um diretor em Configuracoes > Usuarios.
          */}
          <span className="text-grafite">
            Peca a redefinicao a um diretor da equipe.
          </span>
        </p>
      </div>
    </main>
  );
}
