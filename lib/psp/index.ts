import "server-only";

import { ehVitrineDemonstracao } from "@/lib/ambiente";
import { provedorAsaas } from "@/lib/psp/asaas";
import { provedorMock } from "@/lib/psp/mock";
import type { ProvedorPagamento } from "@/lib/psp/tipos";

export type * from "@/lib/psp/tipos";

/**
 * Selecao do provedor de pagamentos.
 *
 * O resto da aplicacao chama sempre `obterProvedor()` e nunca importa
 * `provedorAsaas` ou `provedorMock` diretamente. Assim a troca de PSP - ou a
 * alternancia entre mock e real - acontece por variavel de ambiente.
 */

let cache: ProvedorPagamento | null = null;

export function obterProvedor(): ProvedorPagamento {
  if (cache) return cache;

  const escolhido = (process.env.PSP_PROVIDER || "mock").toLowerCase();

  if (escolhido === "mock") {
    // Guarda de producao. Um deploy que suba com PSP_PROVIDER=mock por
    // esquecimento passaria a emitir cobrancas ficticias: o cliente veria um QR
    // Code que nunca cai na conta, e o painel nunca confirmaria o pagamento.
    // Falhar imediatamente e muito melhor do que descobrir isso pelo cliente.
    //
    // A excecao e a vitrine de demonstracao: um ambiente publicado de proposito
    // para mostrar o produto antes de a conta no PSP existir. Ela exige a
    // variavel PERMITIR_PSP_MOCK="sim", declarada a mao.
    //
    // O ponto da trava e nunca cair em mock por OMISSAO. Exigir uma variavel
    // escrita deliberadamente preserva isso: esquecer de configurar continua
    // derrubando o deploy, porque esquecimento nunca produz a string "sim".
    // Quando ela esta ligada, a interface avisa em toda tela - inclusive na
    // pagina publica - que nenhuma cobranca ali e real.
    if (process.env.NODE_ENV === "production" && !ehVitrineDemonstracao()) {
      throw new Error(
        "PSP_PROVIDER=mock e proibido em producao. " +
          'Configure PSP_PROVIDER=asaas com ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN, ou defina PERMITIR_PSP_MOCK="sim" para publicar uma vitrine de demonstracao com cobrancas ficticias.',
      );
    }
    cache = provedorMock;
    return cache;
  }

  if (escolhido === "asaas") {
    cache = provedorAsaas;
    return cache;
  }

  throw new Error(
    `PSP_PROVIDER="${escolhido}" nao reconhecido. Valores aceitos: "mock", "asaas".`,
  );
}

/** true quando estamos rodando com o provider de desenvolvimento. */
export function usandoProviderMock(): boolean {
  return obterProvedor().nome === "mock";
}

// Reexportado por conveniencia: quem ja depende de lib/psp nao precisa
// importar lib/ambiente separadamente. A definicao mora la para que o layout
// raiz possa consultar o ambiente sem arrastar os providers consigo.
export { ehVitrineDemonstracao } from "@/lib/ambiente";

/**
 * Remove qualquer resquicio de dado de cartao antes de persistir um payload.
 *
 * Secao 10, regra 7: numero, CVV e validade jamais passam pelo servidor do
 * PaivaPay nem aparecem em log. O checkout hospedado do PSP nao deveria nos
 * enviar esses campos, mas gravamos payloads crus para auditoria e suporte -
 * entao filtramos por garantia, em vez de confiar no formato de terceiro.
 */
const CAMPOS_PROIBIDOS = [
  "creditcard",
  "credit_card",
  "cardnumber",
  "card_number",
  "number",
  "ccv",
  "cvv",
  "cvc",
  "securitycode",
  "security_code",
  "expirymonth",
  "expiry_month",
  "expiryyear",
  "expiry_year",
  "holdername",
  "holder_name",
];

export function sanitizarPayload(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(sanitizarPayload);
  }

  if (valor && typeof valor === "object") {
    const resultado: Record<string, unknown> = {};

    for (const [chave, item] of Object.entries(valor)) {
      const normalizada = chave.toLowerCase().replace(/[^a-z_]/g, "");

      if (CAMPOS_PROIBIDOS.includes(normalizada)) {
        resultado[chave] = "[REMOVIDO]";
        continue;
      }

      resultado[chave] = sanitizarPayload(item);
    }

    return resultado;
  }

  return valor;
}
