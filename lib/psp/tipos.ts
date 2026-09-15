import type { FormaPagamento } from "@prisma/client";

/**
 * Contrato do provedor de pagamentos (PSP).
 *
 * Secao 4 da especificacao. Todo o resto da aplicacao fala com esta interface,
 * nunca com o Asaas diretamente. Duas consequencias praticas:
 *
 *  - trocar de PSP (Asaas, Iugu, Pagar.me) custa escrever um novo arquivo que
 *    implemente esta interface, sem tocar em telas, rotas ou regras de negocio;
 *  - o desenvolvimento local roda com o provider mock, sem conta, sem rede e
 *    sem dinheiro real.
 *
 * Secao 2.2: nenhum metodo desta interface movimenta saldo, faz saque ou
 * transferencia entre usuarios. O dinheiro sai do pagador e cai direto na conta
 * bancaria da Paiva Studio registrada no PSP - nunca fica "dentro" do PaivaPay.
 */

export type DadosClientePsp = {
  nome: string;
  /** Somente digitos. */
  documento: string;
  email: string;
  telefone?: string | null;
};

export type DadosCobrancaPsp = {
  /** Id do cliente dentro do PSP. */
  clienteIdNoPsp: string;
  /** EM CENTAVOS. A conversao para reais acontece dentro de cada provider. */
  valorTotal: number;
  vencimento: Date;
  descricao: string;
  formasPagamentoAceitas: FormaPagamento[];
  /** Referencia interna, para conciliar o registro do PSP com o nosso. */
  referenciaExterna: string;
};

/** Dados de pagamento devolvidos pelo PSP. Nunca contem dado de cartao. */
export type DadosPagamento = {
  pix?: {
    /** Payload copia-e-cola (BR Code). */
    payload: string;
    /** Imagem do QR Code em data URL, quando o PSP ja devolve pronta. */
    qrCodeBase64?: string;
    expiraEm?: string;
  };
  boleto?: {
    linhaDigitavel: string;
    codigoBarras?: string;
    urlPdf: string;
  };
  cartao?: {
    /**
     * URL do checkout hospedado do PSP.
     *
     * Secao 2.2 e secao 10, regra 7: numero, CVV e validade jamais passam pelo
     * servidor do PaivaPay. O pagador digita o cartao dentro do dominio do PSP.
     * Isso e o que nos mantem fora do escopo de certificacao PCI-DSS.
     */
    urlCheckout: string;
  };
};

export type RespostaCriacaoCobranca = {
  idNoPsp: string;
  dadosPagamento: DadosPagamento;
};

/** Status da cobranca normalizado, independente do vocabulario de cada PSP. */
export type StatusPsp =
  | "aguardando"
  | "pago"
  | "vencido"
  | "cancelado"
  | "estornado";

export type ConsultaCobranca = {
  idNoPsp: string;
  status: StatusPsp;
  pagoEm: Date | null;
  /** EM CENTAVOS. Pode divergir do cobrado em pagamento parcial. */
  valorPago: number | null;
  formaPagamento: FormaPagamento | null;
};

/** Evento de webhook ja normalizado. */
export type EventoNormalizado = {
  /**
   * Identificador unico do evento no PSP.
   * Gravado com restricao de unicidade para garantir idempotencia
   * (secao 10, regra 3).
   */
  idEventoPsp: string;
  tipo: string;
  idCobrancaNoPsp: string | null;
  status: StatusPsp | null;
  pagoEm: Date | null;
  valorPago: number | null;
  formaPagamento: FormaPagamento | null;
};

export type ResultadoValidacaoWebhook =
  | { valido: true }
  | { valido: false; motivo: string };

export interface ProvedorPagamento {
  readonly nome: string;

  /** Cria (ou reaproveita) o cliente no PSP e devolve o id de la. */
  criarCliente(dados: DadosClientePsp): Promise<string>;

  criarCobranca(dados: DadosCobrancaPsp): Promise<RespostaCriacaoCobranca>;

  /**
   * Consulta direta o status no PSP.
   * Usada pela reconciliacao diaria (secao 10, regra 4), que e a rede de
   * seguranca para quando um webhook nao chega.
   */
  consultarCobranca(idNoPsp: string): Promise<ConsultaCobranca>;

  cancelarCobranca(idNoPsp: string): Promise<void>;

  /**
   * Valida a assinatura/token do webhook (secao 10, regra 2).
   * Requisicao sem assinatura valida e descartada e registrada.
   */
  validarAssinaturaWebhook(
    cabecalhos: Headers,
    corpoBruto: string,
  ): ResultadoValidacaoWebhook;

  /** Traduz o payload do PSP para o formato normalizado. */
  interpretarWebhook(payload: unknown): EventoNormalizado | null;
}
