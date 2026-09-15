import "server-only";

import { db } from "@/lib/db";
import { obterIp } from "@/lib/auth/sessao";
import type { Prisma } from "@prisma/client";

/**
 * Log de auditoria (secao 10, regra 8 da especificacao).
 *
 * "Toda criacao, alteracao e cancelamento de cobranca e registrado com
 *  usuario, data e IP. Registros de auditoria nao podem ser editados nem
 *  apagados pela aplicacao."
 *
 * Por isso este modulo expoe SOMENTE a funcao de registrar. Nao existe aqui
 * update nem delete, e nao deve passar a existir. Se um dia for preciso expurgar
 * registros antigos por politica de retencao, que seja por rotina de banco
 * documentada e fora do alcance da aplicacao.
 */

export type AcaoAuditoria =
  | "cobranca.criada"
  | "cobranca.atualizada"
  | "cobranca.cancelada"
  | "cobranca.paga"
  | "cobranca.estornada"
  | "cobranca.link_copiado"
  | "cobranca.email_reenviado"
  | "cliente.criado"
  | "cliente.atualizado"
  | "cliente.desativado"
  | "usuario.login"
  | "usuario.login_falhou"
  | "usuario.logout"
  | "usuario.criado"
  | "usuario.atualizado"
  | "configuracao.atualizada"
  | "webhook.recebido"
  | "webhook.rejeitado"
  | "reconciliacao.divergencia";

type ParametrosRegistro = {
  usuarioId?: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  dadosAnteriores?: Prisma.InputJsonValue | null;
  dadosNovos?: Prisma.InputJsonValue | null;
  /** Informe quando nao houver contexto de requisicao (rotinas automaticas). */
  ip?: string | null;
};

/**
 * Grava uma entrada de auditoria.
 *
 * Nunca lanca excecao: uma falha ao auditar nao pode derrubar a operacao de
 * negocio que o usuario pediu. A falha e registrada no log do servidor para
 * investigacao.
 */
export async function registrarAuditoria({
  usuarioId,
  acao,
  entidade,
  entidadeId,
  dadosAnteriores,
  dadosNovos,
  ip,
}: ParametrosRegistro): Promise<void> {
  try {
    const ipResolvido = ip !== undefined ? ip : await obterIp().catch(() => null);

    await db.logAuditoria.create({
      data: {
        usuarioId: usuarioId ?? null,
        acao,
        entidade,
        entidadeId: entidadeId ?? null,
        dadosAnteriores: dadosAnteriores ?? undefined,
        dadosNovos: dadosNovos ?? undefined,
        ip: ipResolvido,
      },
    });
  } catch (erro) {
    console.error("[auditoria] falha ao registrar", { acao, entidade, erro });
  }
}
