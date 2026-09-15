"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirUsuarioEmAcao } from "@/lib/auth/guarda";
import { db } from "@/lib/db";
import { centavosParaReais } from "@/lib/dinheiro";
import { usandoProviderMock } from "@/lib/psp";

/**
 * Simulacao de pagamento - APENAS DESENVOLVIMENTO.
 *
 * Serve para fechar o criterio de aceite da Fase 1 (secao 12) antes de a conta
 * no Asaas existir: criar uma cobranca no painel, abrir o link, "pagar" e ver o
 * status mudar sozinho.
 *
 * Decisao importante: em vez de marcar a cobranca como paga direto no banco,
 * esta acao monta um payload no formato do PSP e faz uma requisicao HTTP real
 * ao nosso proprio endpoint de webhook. Assim o teste exercita exatamente o
 * caminho que vai rodar em producao - validacao de assinatura, gravacao
 * idempotente do evento, atualizacao de status e registro de auditoria. Um
 * atalho que escrevesse no banco testaria um caminho que nao existe em
 * producao, e o primeiro pagamento real seria o primeiro teste de verdade.
 */
export async function simularPagamento(dados: FormData) {
  // Duas guardas independentes. A de ambiente vale mesmo que alguem configure
  // PSP_PROVIDER=mock por engano em um servidor.
  if (process.env.NODE_ENV === "production" || !usandoProviderMock()) {
    throw new Error(
      "simularPagamento so existe em desenvolvimento com PSP_PROVIDER=mock.",
    );
  }

  const sessao = await exigirUsuarioEmAcao();
  if (!sessao.ok) return;

  const cobrancaId = String(dados.get("cobrancaId") ?? "");

  const cobranca = await db.cobranca.findUnique({
    where: { id: cobrancaId },
    select: { id: true, idNoPsp: true, valorTotal: true, formasPagamentoAceitas: true },
  });

  if (!cobranca?.idNoPsp) return;

  const forma = cobranca.formasPagamentoAceitas[0] ?? "pix";
  const formaNoPsp = { pix: "PIX", cartao: "CREDIT_CARD", boleto: "BOLETO" }[
    forma
  ];

  const payload = {
    id: `evt_mock_${randomUUID()}`,
    event: "PAYMENT_RECEIVED",
    payment: {
      id: cobranca.idNoPsp,
      status: "RECEIVED",
      value: centavosParaReais(cobranca.valorTotal),
      billingType: formaNoPsp,
      paymentDate: new Date().toISOString(),
    },
  };

  const urlBase = process.env.APP_URL || "http://localhost:3000";

  const resposta = await fetch(`${urlBase}/api/webhooks/asaas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // O mesmo header que o Asaas envia em producao.
      "asaas-access-token": process.env.ASAAS_WEBHOOK_TOKEN || "mock-webhook-token",
    },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    console.error(
      "[dev] webhook simulado falhou:",
      resposta.status,
      await resposta.text(),
    );
  }

  revalidatePath("/painel");
  revalidatePath("/painel/cobrancas");
  revalidatePath(`/painel/cobrancas/${cobrancaId}`);
}
