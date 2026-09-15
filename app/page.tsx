import { redirect } from "next/navigation";
import { obterUsuarioSessao } from "@/lib/auth/sessao";

/**
 * A raiz nao tem conteudo proprio: o PaivaPay tem dois pontos de entrada, o
 * painel (para a equipe) e o link de pagamento (para o pagador, que chega
 * direto em /pagar/<token> e nunca passa por aqui).
 */
export default async function PaginaRaiz() {
  const usuario = await obterUsuarioSessao();
  redirect(usuario ? "/painel" : "/entrar");
}
