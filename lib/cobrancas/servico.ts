import "server-only";

import { Prisma, type FormaPagamento } from "@prisma/client";
import { db } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { somarItens } from "@/lib/dinheiro";
import { obterProvedor, sanitizarPayload } from "@/lib/psp";
import type { StatusPsp } from "@/lib/psp/tipos";
import { gerarTokenPublico } from "@/lib/token";

/**
 * Regras de negocio das cobrancas.
 *
 * Este arquivo concentra a secao 10 da especificacao - "estas regras nao sao
 * sugestoes; erros aqui causam prejuizo financeiro real". Leia os comentarios
 * antes de alterar qualquer coisa aqui.
 */

export type ItemEntrada = {
  descricao: string;
  quantidade: number;
  /** EM CENTAVOS. */
  valorUnitario: number;
};

export type EntradaNovaCobranca = {
  clienteId: string;
  descricao: string;
  itens: ItemEntrada[];
  vencimento: Date;
  formasPagamentoAceitas: FormaPagamento[];
  usuarioId: string;
};

export type ResultadoCriacao =
  | { ok: true; cobrancaId: string; tokenPublico: string }
  | { ok: false; erro: string };

/**
 * Cria uma cobranca avulsa (fluxo 7.1 da especificacao).
 *
 * A cobranca nasce como rascunho no nosso banco, e so vira
 * aguardando_pagamento depois que o PSP confirma a criacao e devolve os dados
 * de pagamento. Se a chamada ao PSP falhar, sobra um rascunho no painel - nao
 * uma cobranca que o cliente nunca conseguiria pagar.
 */
export async function criarCobranca(
  entrada: EntradaNovaCobranca,
): Promise<ResultadoCriacao> {
  const { clienteId, descricao, itens, vencimento, usuarioId } = entrada;
  const formas = entrada.formasPagamentoAceitas;

  if (itens.length === 0) {
    return { ok: false, erro: "Inclua ao menos um item na cobranca." };
  }

  if (formas.length === 0) {
    return { ok: false, erro: "Selecione ao menos uma forma de pagamento." };
  }

  // Valor calculado no servidor a partir dos itens. O total que o navegador
  // enviou e ignorado de proposito: aceitar um total vindo do cliente
  // permitiria cobrar R$ 0,01 por um servico de R$ 5.000 alterando o formulario.
  const valorTotal = somarItens(itens);

  if (valorTotal <= 0) {
    return { ok: false, erro: "O valor total precisa ser maior que zero." };
  }

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || !cliente.ativo) {
    return { ok: false, erro: "Cliente nao encontrado ou inativo." };
  }

  // Conta recebedora (secao 4.3). Na v1 e sempre a mesma: a da Paiva Studio.
  // Na v2 este e o ponto onde passara a entrar a subconta de cada empresa.
  const contaRecebedora = await db.contaRecebedora.findFirst({
    where: { padrao: true },
  });

  if (!contaRecebedora) {
    return {
      ok: false,
      erro:
        "Nenhuma conta recebedora padrao configurada. Rode o seed do banco (npm run db:seed).",
    };
  }

  const provedor = obterProvedor();

  // 1. Garante que o cliente exista no PSP.
  let clienteIdNoPsp = cliente.idNoPsp;
  if (!clienteIdNoPsp) {
    try {
      clienteIdNoPsp = await provedor.criarCliente({
        nome: cliente.nome,
        documento: cliente.documento,
        email: cliente.email,
        telefone: cliente.telefone,
      });
      await db.cliente.update({
        where: { id: cliente.id },
        data: { idNoPsp: clienteIdNoPsp },
      });
    } catch (erro) {
      console.error("[cobranca] falha ao criar cliente no PSP", erro);
      return {
        ok: false,
        erro: "Nao foi possivel registrar o cliente no provedor de pagamentos.",
      };
    }
  }

  // 2. Cria a cobranca local como rascunho, com o token publico definitivo.
  const cobranca = await db.cobranca.create({
    data: {
      clienteId: cliente.id,
      contaRecebedoraId: contaRecebedora.id,
      tokenPublico: gerarTokenPublico(),
      descricao,
      valorTotal,
      vencimento,
      status: "rascunho",
      formasPagamentoAceitas: formas,
      criadoPor: usuarioId,
      itens: {
        create: itens.map((item) => ({
          descricao: item.descricao,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.quantidade * item.valorUnitario,
        })),
      },
      eventos: {
        create: { tipo: "criada", descricao: "Cobranca criada no painel" },
      },
    },
  });

  // 3. Registra no PSP.
  try {
    const resposta = await provedor.criarCobranca({
      clienteIdNoPsp,
      valorTotal,
      vencimento,
      descricao,
      formasPagamentoAceitas: formas,
      referenciaExterna: cobranca.id,
    });

    await db.cobranca.update({
      where: { id: cobranca.id },
      data: {
        idNoPsp: resposta.idNoPsp,
        dadosPagamento: resposta.dadosPagamento as Prisma.InputJsonValue,
        status: "aguardando_pagamento",
      },
    });
  } catch (erro) {
    console.error("[cobranca] falha ao criar cobranca no PSP", erro);
    return {
      ok: false,
      erro:
        "A cobranca foi salva como rascunho, mas o provedor de pagamentos recusou o registro. Verifique as configuracoes e tente novamente.",
    };
  }

  await registrarAuditoria({
    usuarioId,
    acao: "cobranca.criada",
    entidade: "cobranca",
    entidadeId: cobranca.id,
    dadosNovos: {
      clienteId: cliente.id,
      valorTotal,
      vencimento: vencimento.toISOString(),
      formasPagamentoAceitas: formas,
    },
  });

  return {
    ok: true,
    cobrancaId: cobranca.id,
    tokenPublico: cobranca.tokenPublico,
  };
}

/**
 * Aplica ao nosso banco um status vindo do PSP.
 *
 * Secao 10, regra 1: confirmacao de pagamento vem APENAS do backend. Esta
 * funcao so pode ser chamada a partir de (a) um webhook cuja assinatura ja foi
 * validada ou (b) uma consulta direta a API do PSP, feita pela reconciliacao.
 * Nao a exponha em server action nem em rota que o navegador possa acionar.
 *
 * E idempotente: aplicar "pago" duas vezes na mesma cobranca nao gera dois
 * recibos nem soma o valor duas vezes no relatorio.
 */
export async function aplicarStatusDoPsp(params: {
  idCobrancaNoPsp: string;
  status: StatusPsp;
  pagoEm: Date | null;
  valorPago: number | null;
  formaPagamento: FormaPagamento | null;
  origem: "webhook" | "reconciliacao";
  payloadBruto?: unknown;
}): Promise<{ atualizada: boolean; motivo?: string }> {
  const {
    idCobrancaNoPsp,
    status,
    pagoEm,
    valorPago,
    formaPagamento,
    origem,
    payloadBruto,
  } = params;

  const cobranca = await db.cobranca.findFirst({
    where: { idNoPsp: idCobrancaNoPsp },
    select: { id: true, status: true, valorTotal: true, clienteId: true },
  });

  if (!cobranca) {
    return {
      atualizada: false,
      motivo: `cobranca com id_no_psp=${idCobrancaNoPsp} nao encontrada`,
    };
  }

  // Ja esta paga: nao reprocessa. Esta guarda e a segunda linha de defesa da
  // idempotencia - a primeira e a unicidade de id_evento_psp em eventos_webhook.
  if (cobranca.status === "pago" && status === "pago") {
    return { atualizada: false, motivo: "cobranca ja estava paga" };
  }

  // Cobranca cancelada que recebe confirmacao de pagamento e uma divergencia
  // real: o cliente pagou um boleto que ja tinha sido cancelado. Nao mudamos o
  // status automaticamente - registramos para tratamento manual, porque a
  // decisao (estornar ou reativar) e de negocio, nao de codigo.
  if (cobranca.status === "cancelado" && status === "pago") {
    await db.eventoCobranca.create({
      data: {
        cobrancaId: cobranca.id,
        tipo: "paga",
        descricao:
          "ATENCAO: pagamento recebido para uma cobranca cancelada. Tratamento manual necessario.",
        metadados: { origem, valorPago } as Prisma.InputJsonValue,
      },
    });
    await registrarAuditoria({
      acao: "reconciliacao.divergencia",
      entidade: "cobranca",
      entidadeId: cobranca.id,
      dadosNovos: { idCobrancaNoPsp, status, valorPago } as Prisma.InputJsonValue,
      ip: null,
    });
    return { atualizada: false, motivo: "pagamento em cobranca cancelada" };
  }

  const statusParaBanco: Record<StatusPsp, Prisma.CobrancaUpdateInput["status"]> =
    {
      aguardando: "aguardando_pagamento",
      pago: "pago",
      vencido: "vencido",
      cancelado: "cancelado",
      estornado: "estornado",
    };

  const novoStatus = statusParaBanco[status];
  if (novoStatus === cobranca.status) {
    return { atualizada: false, motivo: "status ja estava atualizado" };
  }

  await db.$transaction(async (tx) => {
    await tx.cobranca.update({
      where: { id: cobranca.id },
      data: {
        status: novoStatus,
        pagoEm: status === "pago" ? (pagoEm ?? new Date()) : undefined,
        canceladoEm: status === "cancelado" ? new Date() : undefined,
      },
    });

    if (status === "pago") {
      await tx.transacao.create({
        data: {
          cobrancaId: cobranca.id,
          formaPagamento: formaPagamento ?? "pix",
          valor: valorPago ?? cobranca.valorTotal,
          status: "confirmada",
          idNoPsp: idCobrancaNoPsp,
          payloadBruto: payloadBruto
            ? (sanitizarPayload(payloadBruto) as Prisma.InputJsonValue)
            : undefined,
        },
      });
    }

    const tipoEvento =
      status === "pago"
        ? "paga"
        : status === "vencido"
          ? "vencida"
          : status === "cancelado"
            ? "cancelada"
            : status === "estornado"
              ? "estornada"
              : null;

    if (tipoEvento) {
      await tx.eventoCobranca.create({
        data: {
          cobrancaId: cobranca.id,
          tipo: tipoEvento,
          descricao: `Status atualizado pelo PSP via ${origem}`,
          metadados: {
            origem,
            valorPago,
            formaPagamento,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  // Pagamento parcial ou a maior: o valor confirmado nao bate com o cobrado.
  // Nao bloqueia nada, mas precisa ficar visivel para conferencia.
  if (status === "pago" && valorPago !== null && valorPago !== cobranca.valorTotal) {
    await registrarAuditoria({
      acao: "reconciliacao.divergencia",
      entidade: "cobranca",
      entidadeId: cobranca.id,
      dadosNovos: {
        valorCobrado: cobranca.valorTotal,
        valorPago,
      } as Prisma.InputJsonValue,
      ip: null,
    });
  }

  if (status === "pago") {
    await registrarAuditoria({
      acao: "cobranca.paga",
      entidade: "cobranca",
      entidadeId: cobranca.id,
      dadosNovos: { origem, valorPago, formaPagamento } as Prisma.InputJsonValue,
      ip: null,
    });
  }

  return { atualizada: true };
}

/**
 * Cancela uma cobranca a pedido do painel.
 * Secao 10, regra 9: cobranca paga nao pode ser alterada.
 */
export async function cancelarCobranca(
  cobrancaId: string,
  usuarioId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const cobranca = await db.cobranca.findUnique({
    where: { id: cobrancaId },
    select: { id: true, status: true, idNoPsp: true },
  });

  if (!cobranca) return { ok: false, erro: "Cobranca nao encontrada." };

  if (cobranca.status === "pago") {
    return {
      ok: false,
      erro:
        "Cobranca paga nao pode ser cancelada. A correcao e feita por estorno e emissao de uma nova cobranca.",
    };
  }

  if (cobranca.status === "cancelado") {
    return { ok: false, erro: "Cobranca ja esta cancelada." };
  }

  if (cobranca.idNoPsp) {
    try {
      await obterProvedor().cancelarCobranca(cobranca.idNoPsp);
    } catch (erro) {
      console.error("[cobranca] falha ao cancelar no PSP", erro);
      return {
        ok: false,
        erro:
          "O provedor de pagamentos recusou o cancelamento. A cobranca continua ativa.",
      };
    }
  }

  await db.$transaction([
    db.cobranca.update({
      where: { id: cobranca.id },
      data: { status: "cancelado", canceladoEm: new Date() },
    }),
    db.eventoCobranca.create({
      data: {
        cobrancaId: cobranca.id,
        tipo: "cancelada",
        descricao: "Cancelada pelo painel",
      },
    }),
  ]);

  await registrarAuditoria({
    usuarioId,
    acao: "cobranca.cancelada",
    entidade: "cobranca",
    entidadeId: cobranca.id,
    dadosAnteriores: { status: cobranca.status },
    dadosNovos: { status: "cancelado" },
  });

  return { ok: true };
}
