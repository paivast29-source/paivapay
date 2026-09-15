import "server-only";

import { redirect } from "next/navigation";
import { obterUsuarioSessao, type UsuarioSessao } from "@/lib/auth/sessao";

/**
 * Guardas de acesso do painel (secao 6.1 da especificacao).
 *
 *   diretor     - acesso total, incluindo relatorios financeiros,
 *                 configuracoes e gestao de usuarios
 *   operacional - cria e envia cobrancas, consulta status, mas nao acessa
 *                 configuracoes nem relatorios consolidados
 *
 * Estas funcoes sao a unica fonte de verdade sobre permissao. Esconder um item
 * de menu no frontend nao e controle de acesso: toda pagina e toda server
 * action restrita precisa chamar a guarda correspondente.
 */

/** Exige um usuario autenticado. Redireciona para o login se nao houver. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await obterUsuarioSessao();
  if (!usuario) redirect("/entrar");
  return usuario;
}

/** Exige o papel de diretor. */
export async function exigirDiretor(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "diretor") redirect("/painel?erro=sem-permissao");
  return usuario;
}

/** Versao para server actions: devolve erro em vez de redirecionar. */
export async function exigirUsuarioEmAcao(): Promise<
  { ok: true; usuario: UsuarioSessao } | { ok: false; erro: string }
> {
  const usuario = await obterUsuarioSessao();
  if (!usuario) {
    return { ok: false, erro: "Sessao expirada. Entre novamente." };
  }
  return { ok: true, usuario };
}

export async function exigirDiretorEmAcao(): Promise<
  { ok: true; usuario: UsuarioSessao } | { ok: false; erro: string }
> {
  const resultado = await exigirUsuarioEmAcao();
  if (!resultado.ok) return resultado;

  if (resultado.usuario.papel !== "diretor") {
    return {
      ok: false,
      erro: "Esta acao e restrita a usuarios com papel de diretor.",
    };
  }
  return resultado;
}

export function ehDiretor(usuario: UsuarioSessao | null): boolean {
  return usuario?.papel === "diretor";
}
