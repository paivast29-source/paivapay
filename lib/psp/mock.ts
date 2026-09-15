import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { montarBrCodePix } from "@/lib/psp/pix-brcode";
import { compararSegredos } from "@/lib/token";
import type {
  ConsultaCobranca,
  DadosClientePsp,
  DadosCobrancaPsp,
  EventoNormalizado,
  ProvedorPagamento,
  RespostaCriacaoCobranca,
  ResultadoValidacaoWebhook,
  StatusPsp,
} from "@/lib/psp/tipos";
import type { FormaPagamento } from "@prisma/client";

/**
 * Provider de desenvolvimento.
 *
 * Nao faz chamada de rede, nao move dinheiro e nao depende de conta em PSP
 * nenhum. Serve para rodar e testar todo o fluxo da Fase 1 - criar cobranca,
 * abrir o link publico, ver o QR Code, confirmar o pagamento via webhook e
 * acompanhar a mudanca de status no painel - antes de a conta no Asaas existir.
 *
 * O formato dos dados que ele devolve e deliberadamente realista (BR Code EMV
 * valido, linha digitavel de 47 posicoes) para que a interface nao precise
 * mudar quando o Asaas entrar.
 *
 * ATENCAO: o modulo inteiro se recusa a funcionar com NODE_ENV=production.
 * Ver a guarda em lib/psp/index.ts - um deploy que suba com PSP_PROVIDER=mock
 * por engano falha na hora, em vez de gerar cobrancas falsas em producao.
 */

const CHAVE_PIX_FICTICIA = "pagamentos@paivast.com.br";
const CIDADE_RECEBEDOR = "SAO PAULO";

/** Token do webhook no ambiente mock. Espelha o fluxo do Asaas. */
function tokenWebhookMock(): string {
  return process.env.ASAAS_WEBHOOK_TOKEN || "mock-webhook-token";
}

/** Linha digitavel ficticia de 47 posicoes, so para a interface ter o que exibir. */
function gerarLinhaDigitavelFicticia(valorCentavos: number): string {
  const aleatorio = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

  const valor = valorCentavos.toString().padStart(10, "0").slice(-10);
  const bruto = `03399${aleatorio(5)}${aleatorio(11)}${aleatorio(11)}${aleatorio(5)}${valor}`;
  const digitos = bruto.slice(0, 47).padEnd(47, "0");

  return digitos.replace(
    /^(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})$/,
    "$1.$2 $3.$4 $5.$6 $7 $8",
  );
}

function mapearStatus(status: string): StatusPsp | null {
  const mapa: Record<string, StatusPsp> = {
    PENDING: "aguardando",
    RECEIVED: "pago",
    CONFIRMED: "pago",
    OVERDUE: "vencido",
    DELETED: "cancelado",
    REFUNDED: "estornado",
  };
  return mapa[status] ?? null;
}

function mapearFormaPagamento(forma: string | null): FormaPagamento | null {
  if (!forma) return null;
  const mapa: Record<string, FormaPagamento> = {
    PIX: "pix",
    CREDIT_CARD: "cartao",
    BOLETO: "boleto",
  };
  return mapa[forma] ?? null;
}

export const provedorMock: ProvedorPagamento = {
  nome: "mock",

  async criarCliente(dados: DadosClientePsp): Promise<string> {
    // Prefixo identifica a origem em qualquer inspecao do banco.
    return `mock_cli_${dados.documento.slice(0, 6)}_${randomUUID().slice(0, 8)}`;
  },

  async criarCobranca(
    dados: DadosCobrancaPsp,
  ): Promise<RespostaCriacaoCobranca> {
    const idNoPsp = `mock_cob_${randomUUID()}`;
    const aceita = (forma: FormaPagamento) =>
      dados.formasPagamentoAceitas.includes(forma);

    const dadosPagamento: RespostaCriacaoCobranca["dadosPagamento"] = {};

    if (aceita("pix")) {
      dadosPagamento.pix = {
        payload: montarBrCodePix({
          chavePix: CHAVE_PIX_FICTICIA,
          nomeRecebedor: process.env.CONTA_RECEBEDORA_NOME ?? "Paiva Studio",
          cidadeRecebedor: CIDADE_RECEBEDOR,
          valorCentavos: dados.valorTotal,
          txid: dados.referenciaExterna,
        }),
        // O vencimento do QR acompanha o da cobranca, ao fim do dia.
        expiraEm: new Date(
          new Date(dados.vencimento).setHours(23, 59, 59, 0),
        ).toISOString(),
      };
    }

    if (aceita("boleto")) {
      dadosPagamento.boleto = {
        linhaDigitavel: gerarLinhaDigitavelFicticia(dados.valorTotal),
        urlPdf: `/api/dev/boleto/${idNoPsp}.pdf`,
      };
    }

    if (aceita("cartao")) {
      // Em producao esta URL aponta para o checkout hospedado do PSP, em outro
      // dominio. No mock apontamos para uma tela local que imita o checkout.
      dadosPagamento.cartao = {
        urlCheckout: `/dev/checkout-cartao/${idNoPsp}`,
      };
    }

    return { idNoPsp, dadosPagamento };
  },

  async consultarCobranca(idNoPsp: string): Promise<ConsultaCobranca> {
    // Nao existe servico externo para consultar: o mock devolve o que a nossa
    // propria base registra. Na pratica isso faz a reconciliacao diaria virar
    // uma operacao sem efeito em desenvolvimento, o que e o comportamento
    // correto - nao ha divergencia possivel sem um terceiro envolvido.
    const cobranca = await db.cobranca.findFirst({
      where: { idNoPsp },
      select: { status: true, pagoEm: true, valorTotal: true },
    });

    if (!cobranca) {
      throw new Error(`[mock] cobranca ${idNoPsp} nao encontrada`);
    }

    const statusPorCobranca: Record<string, StatusPsp> = {
      rascunho: "aguardando",
      aguardando_pagamento: "aguardando",
      pago: "pago",
      vencido: "vencido",
      cancelado: "cancelado",
      estornado: "estornado",
    };

    return {
      idNoPsp,
      status: statusPorCobranca[cobranca.status] ?? "aguardando",
      pagoEm: cobranca.pagoEm,
      valorPago: cobranca.status === "pago" ? cobranca.valorTotal : null,
      formaPagamento: null,
    };
  },

  async cancelarCobranca(): Promise<void> {
    // Sem servico externo, nao ha nada a cancelar fora da nossa base.
  },

  validarAssinaturaWebhook(cabecalhos: Headers): ResultadoValidacaoWebhook {
    const recebido = cabecalhos.get("asaas-access-token");

    if (!recebido) {
      return { valido: false, motivo: "header asaas-access-token ausente" };
    }

    if (!compararSegredos(recebido, tokenWebhookMock())) {
      return { valido: false, motivo: "token de webhook invalido" };
    }

    return { valido: true };
  },

  interpretarWebhook(payload: unknown): EventoNormalizado | null {
    // O mock emite o mesmo formato do Asaas, para exercitar exatamente o mesmo
    // caminho de codigo que vai rodar em producao.
    if (!payload || typeof payload !== "object") return null;

    const corpo = payload as Record<string, unknown>;
    const pagamento = corpo.payment as Record<string, unknown> | undefined;

    const idEvento = typeof corpo.id === "string" ? corpo.id : null;
    const tipo = typeof corpo.event === "string" ? corpo.event : null;
    if (!idEvento || !tipo) return null;

    const status =
      pagamento && typeof pagamento.status === "string"
        ? mapearStatus(pagamento.status)
        : null;

    const dataPagamento =
      pagamento && typeof pagamento.paymentDate === "string"
        ? new Date(pagamento.paymentDate)
        : null;

    const valorEmReais =
      pagamento && typeof pagamento.value === "number" ? pagamento.value : null;

    return {
      idEventoPsp: idEvento,
      tipo,
      idCobrancaNoPsp:
        pagamento && typeof pagamento.id === "string" ? pagamento.id : null,
      status,
      pagoEm:
        dataPagamento && !Number.isNaN(dataPagamento.getTime())
          ? dataPagamento
          : null,
      valorPago: valorEmReais !== null ? Math.round(valorEmReais * 100) : null,
      formaPagamento:
        pagamento && typeof pagamento.billingType === "string"
          ? mapearFormaPagamento(pagamento.billingType)
          : null,
    };
  },
};
