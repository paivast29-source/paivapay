import { centavosParaReais, reaisParaCentavos } from "@/lib/dinheiro";
import { compararSegredos } from "@/lib/token";
import type {
  ConsultaCobranca,
  DadosClientePsp,
  DadosCobrancaPsp,
  DadosPagamento,
  EventoNormalizado,
  ProvedorPagamento,
  RespostaCriacaoCobranca,
  ResultadoValidacaoWebhook,
  StatusPsp,
} from "@/lib/psp/tipos";
import type { FormaPagamento } from "@prisma/client";

/**
 * Integracao com o Asaas (API v3).
 *
 * Recomendacao da secao 4.1 da especificacao. O criterio inegociavel da secao
 * 4.2 - oferecer subconta e split no catalogo - e atendido pelo Asaas, ainda
 * que a v1 nao use nada disso.
 *
 * Nenhum metodo aqui envia ou recebe dado de cartao. O pagamento com cartao
 * acontece no checkout hospedado do proprio Asaas (campo invoiceUrl), em outro
 * dominio. E isso que mantem o PaivaPay fora do escopo de PCI-DSS
 * (secoes 2.2 e 10, regra 7).
 */

function baseApi(): string {
  return process.env.ASAAS_API_BASE || "https://api-sandbox.asaas.com/v3";
}

function chaveApi(): string {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) {
    throw new Error(
      "ASAAS_API_KEY nao configurada. Preencha o .env ou use PSP_PROVIDER=mock.",
    );
  }
  return chave;
}

type OpcoesRequisicao = {
  metodo?: "GET" | "POST" | "DELETE";
  corpo?: unknown;
};

async function chamarAsaas<T>(
  caminho: string,
  { metodo = "GET", corpo }: OpcoesRequisicao = {},
): Promise<T> {
  const resposta = await fetch(`${baseApi()}${caminho}`, {
    method: metodo,
    headers: {
      access_token: chaveApi(),
      "Content-Type": "application/json",
      // O Asaas pede identificacao da aplicacao integradora.
      "User-Agent": "PaivaPay/1.0",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    // Dados financeiros nunca podem vir de cache.
    cache: "no-store",
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    // O Asaas devolve { errors: [{ code, description }] }.
    let detalhe = texto;
    try {
      const json = JSON.parse(texto) as {
        errors?: { description?: string }[];
      };
      if (json.errors?.length) {
        detalhe = json.errors.map((e) => e.description).join("; ");
      }
    } catch {
      // Mantem o texto cru quando a resposta nao e JSON.
    }
    throw new Error(
      `Asaas respondeu ${resposta.status} em ${metodo} ${caminho}: ${detalhe}`,
    );
  }

  return texto ? (JSON.parse(texto) as T) : ({} as T);
}

/**
 * Traduz as formas aceitas para o billingType do Asaas.
 * Com mais de uma forma habilitada usamos UNDEFINED, que e como o Asaas
 * representa "o pagador escolhe".
 */
function billingType(formas: FormaPagamento[]): string {
  if (formas.length !== 1) return "UNDEFINED";
  const mapa: Record<FormaPagamento, string> = {
    pix: "PIX",
    boleto: "BOLETO",
    cartao: "CREDIT_CARD",
  };
  return mapa[formas[0]];
}

const STATUS_ASAAS: Record<string, StatusPsp> = {
  PENDING: "aguardando",
  AWAITING_RISK_ANALYSIS: "aguardando",
  RECEIVED: "pago",
  CONFIRMED: "pago",
  RECEIVED_IN_CASH: "pago",
  OVERDUE: "vencido",
  DELETED: "cancelado",
  REFUNDED: "estornado",
  REFUND_REQUESTED: "estornado",
  CHARGEBACK_REQUESTED: "estornado",
  CHARGEBACK_DISPUTE: "estornado",
};

function mapearStatus(status: string | undefined): StatusPsp | null {
  if (!status) return null;
  return STATUS_ASAAS[status] ?? null;
}

const FORMAS_ASAAS: Record<string, FormaPagamento> = {
  PIX: "pix",
  BOLETO: "boleto",
  CREDIT_CARD: "cartao",
  DEBIT_CARD: "cartao",
};

function mapearForma(forma: string | undefined | null): FormaPagamento | null {
  if (!forma) return null;
  return FORMAS_ASAAS[forma] ?? null;
}

/** Converte "2026-09-15" para Date sem sofrer deslocamento de fuso. */
function dataParaIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

type RespostaPagamentoAsaas = {
  id: string;
  status?: string;
  value?: number;
  billingType?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

export const provedorAsaas: ProvedorPagamento = {
  nome: "asaas",

  async criarCliente(dados: DadosClientePsp): Promise<string> {
    // O Asaas trata cpfCnpj como identificador natural: se o cliente ja existe,
    // a consulta evita criar um duplicado.
    const existentes = await chamarAsaas<{ data?: { id: string }[] }>(
      `/customers?cpfCnpj=${encodeURIComponent(dados.documento)}`,
    );

    if (existentes.data?.length) {
      return existentes.data[0].id;
    }

    const criado = await chamarAsaas<{ id: string }>("/customers", {
      metodo: "POST",
      corpo: {
        name: dados.nome,
        cpfCnpj: dados.documento,
        email: dados.email,
        mobilePhone: dados.telefone ?? undefined,
        notificationDisabled: true, // quem notifica o cliente e o PaivaPay
      },
    });

    return criado.id;
  },

  async criarCobranca(
    dados: DadosCobrancaPsp,
  ): Promise<RespostaCriacaoCobranca> {
    const pagamento = await chamarAsaas<RespostaPagamentoAsaas>("/payments", {
      metodo: "POST",
      corpo: {
        customer: dados.clienteIdNoPsp,
        billingType: billingType(dados.formasPagamentoAceitas),
        value: centavosParaReais(dados.valorTotal),
        dueDate: dataParaIso(dados.vencimento),
        description: dados.descricao,
        externalReference: dados.referenciaExterna,
      },
    });

    const dadosPagamento: DadosPagamento = {};
    const aceita = (forma: FormaPagamento) =>
      dados.formasPagamentoAceitas.includes(forma);

    if (aceita("pix")) {
      // O QR so existe depois que a cobranca foi criada, por isso e uma segunda
      // chamada. Uma falha aqui nao invalida a cobranca: o pagador ainda pode
      // usar boleto ou cartao, e a tela de Pix mostra o erro.
      try {
        const qr = await chamarAsaas<{
          encodedImage?: string;
          payload?: string;
          expirationDate?: string;
        }>(`/payments/${pagamento.id}/pixQrCode`);

        if (qr.payload) {
          dadosPagamento.pix = {
            payload: qr.payload,
            qrCodeBase64: qr.encodedImage
              ? `data:image/png;base64,${qr.encodedImage}`
              : undefined,
            expiraEm: qr.expirationDate,
          };
        }
      } catch (erro) {
        console.error("[asaas] falha ao obter QR Code Pix", erro);
      }
    }

    if (aceita("boleto")) {
      try {
        const identificacao = await chamarAsaas<{
          identificationField?: string;
          barCode?: string;
        }>(`/payments/${pagamento.id}/identificationField`);

        if (identificacao.identificationField) {
          dadosPagamento.boleto = {
            linhaDigitavel: identificacao.identificationField,
            codigoBarras: identificacao.barCode,
            urlPdf: pagamento.bankSlipUrl ?? "",
          };
        }
      } catch (erro) {
        console.error("[asaas] falha ao obter linha digitavel", erro);
      }
    }

    if (aceita("cartao") && pagamento.invoiceUrl) {
      // Checkout hospedado do Asaas. Nenhum dado de cartao toca o PaivaPay.
      dadosPagamento.cartao = { urlCheckout: pagamento.invoiceUrl };
    }

    return { idNoPsp: pagamento.id, dadosPagamento };
  },

  async consultarCobranca(idNoPsp: string): Promise<ConsultaCobranca> {
    const pagamento = await chamarAsaas<RespostaPagamentoAsaas>(
      `/payments/${idNoPsp}`,
    );

    const dataPagamento = pagamento.paymentDate ?? pagamento.clientPaymentDate;
    const status = mapearStatus(pagamento.status);

    return {
      idNoPsp,
      status: status ?? "aguardando",
      pagoEm: dataPagamento ? new Date(dataPagamento) : null,
      valorPago:
        status === "pago" && typeof pagamento.value === "number"
          ? reaisParaCentavos(pagamento.value)
          : null,
      formaPagamento: mapearForma(pagamento.billingType),
    };
  },

  async cancelarCobranca(idNoPsp: string): Promise<void> {
    await chamarAsaas(`/payments/${idNoPsp}`, { metodo: "DELETE" });
  },

  /**
   * Secao 10, regra 2: todo webhook e validado.
   *
   * O Asaas autentica a notificacao com um token fixo, definido por nos no
   * painel dele e enviado no header `asaas-access-token`. A comparacao e feita
   * em tempo constante para nao vazar o segredo caractere a caractere.
   */
  validarAssinaturaWebhook(cabecalhos: Headers): ResultadoValidacaoWebhook {
    const esperado = process.env.ASAAS_WEBHOOK_TOKEN;

    if (!esperado) {
      // Sem token configurado, aceitar qualquer requisicao deixaria qualquer
      // pessoa na internet marcar cobrancas como pagas. Recusamos tudo.
      return {
        valido: false,
        motivo: "ASAAS_WEBHOOK_TOKEN nao configurado no servidor",
      };
    }

    const recebido = cabecalhos.get("asaas-access-token");
    if (!recebido) {
      return { valido: false, motivo: "header asaas-access-token ausente" };
    }

    if (!compararSegredos(recebido, esperado)) {
      return { valido: false, motivo: "token de webhook invalido" };
    }

    return { valido: true };
  },

  interpretarWebhook(payload: unknown): EventoNormalizado | null {
    if (!payload || typeof payload !== "object") return null;

    const corpo = payload as Record<string, unknown>;
    const pagamento = corpo.payment as RespostaPagamentoAsaas | undefined;

    const idEvento = typeof corpo.id === "string" ? corpo.id : null;
    const tipo = typeof corpo.event === "string" ? corpo.event : null;

    // Sem id de evento nao ha como garantir idempotencia; descartamos.
    if (!idEvento || !tipo) return null;

    const dataPagamento = pagamento?.paymentDate ?? pagamento?.clientPaymentDate;
    const pagoEm = dataPagamento ? new Date(dataPagamento) : null;

    return {
      idEventoPsp: idEvento,
      tipo,
      idCobrancaNoPsp: pagamento?.id ?? null,
      status: mapearStatus(pagamento?.status),
      pagoEm: pagoEm && !Number.isNaN(pagoEm.getTime()) ? pagoEm : null,
      valorPago:
        typeof pagamento?.value === "number"
          ? reaisParaCentavos(pagamento.value)
          : null,
      formaPagamento: mapearForma(pagamento?.billingType),
    };
  },
};
