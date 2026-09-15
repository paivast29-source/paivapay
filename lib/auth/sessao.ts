import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { gerarTokenSessao, hashToken } from "@/lib/token";
import type { Papel } from "@prisma/client";

/**
 * Sessao do painel administrativo.
 *
 * Secao 5 da especificacao: sessao via cookie httpOnly.
 *
 * O cookie carrega o token em claro. O banco guarda somente o SHA-256 dele
 * (ver lib/token.ts), entao um dump do banco nao permite personificar ninguem.
 */

const NOME_COOKIE = "paivapay_sessao";
const DURACAO_HORAS = 12;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};

/** Le o IP real considerando o proxy da Vercel. */
export async function obterIp(): Promise<string | null> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  if (encaminhado) {
    // x-forwarded-for pode vir como "cliente, proxy1, proxy2".
    return encaminhado.split(",")[0].trim();
  }
  return cabecalhos.get("x-real-ip");
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = gerarTokenSessao();
  const expiraEm = new Date(Date.now() + DURACAO_HORAS * 60 * 60 * 1000);

  const cabecalhos = await headers();

  await db.sessao.create({
    data: {
      tokenHash: hashToken(token),
      usuarioId,
      expiraEm,
      ip: await obterIp(),
      userAgent: cabecalhos.get("user-agent")?.slice(0, 500) ?? null,
    },
  });

  const armazemCookies = await cookies();
  armazemCookies.set(NOME_COOKIE, token, {
    httpOnly: true, // inacessivel ao JavaScript do navegador
    secure: process.env.NODE_ENV === "production", // HTTPS obrigatorio (secao 11)
    sameSite: "lax", // barra o envio do cookie em requisicoes cross-site (CSRF)
    path: "/",
    expires: expiraEm,
  });
}

/**
 * Devolve o usuario da sessao atual, ou null.
 *
 * Envolvido em `cache` do React para que varios componentes da mesma
 * requisicao (layout, pagina, guardas) compartilhem uma unica consulta.
 */
export const obterUsuarioSessao = cache(
  async (): Promise<UsuarioSessao | null> => {
    const armazemCookies = await cookies();
    const token = armazemCookies.get(NOME_COOKIE)?.value;
    if (!token) return null;

    const sessao = await db.sessao.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiraEm: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
            ativo: true,
          },
        },
      },
    });

    if (!sessao) return null;

    // Sessao vencida: remove do banco para nao acumular lixo.
    if (sessao.expiraEm < new Date()) {
      await db.sessao.delete({ where: { id: sessao.id } }).catch(() => {});
      return null;
    }

    // Usuario desativado depois de logado perde o acesso imediatamente.
    if (!sessao.usuario.ativo) return null;

    return {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      papel: sessao.usuario.papel,
    };
  },
);

export async function encerrarSessao(): Promise<void> {
  const armazemCookies = await cookies();
  const token = armazemCookies.get(NOME_COOKIE)?.value;

  if (token) {
    await db.sessao
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }

  armazemCookies.delete(NOME_COOKIE);
}

/** Encerra todas as sessoes de um usuario (troca de senha, desativacao). */
export async function encerrarTodasSessoes(usuarioId: string): Promise<void> {
  await db.sessao.deleteMany({ where: { usuarioId } });
}

export const configuracaoSessao = {
  nomeCookie: NOME_COOKIE,
  duracaoHoras: DURACAO_HORAS,
};
