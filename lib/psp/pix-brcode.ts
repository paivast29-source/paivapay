/**
 * Montagem do BR Code do Pix (payload EMV(R) QRCPS-MPM do Banco Central).
 *
 * Usado apenas pelo provider mock, para que o ambiente de desenvolvimento
 * mostre um QR Code com formato real - a tela de pagamento fica identica a de
 * producao. A chave e ficticia, entao o codigo nao e pagavel.
 *
 * Em producao quem monta o BR Code e o PSP; nos apenas repassamos o payload
 * que ele devolve.
 */

/** Monta um campo no formato EMV: id + comprimento (2 digitos) + valor. */
function campo(id: string, valor: string): string {
  const comprimento = valor.length.toString().padStart(2, "0");
  return `${id}${comprimento}${valor}`;
}

/**
 * CRC16/CCITT-FALSE - polinomio 0x1021, valor inicial 0xFFFF.
 * E o algoritmo exigido pela especificacao do BR Code.
 */
function crc16(dados: string): string {
  let crc = 0xffff;

  for (let i = 0; i < dados.length; i++) {
    crc ^= dados.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Remove acentos e caracteres fora do ASCII imprimivel.
 * O padrao do BR Code nao aceita acentuacao nos campos de nome e cidade.
 */
function normalizarTexto(texto: string, tamanhoMaximo: number): string {
  return (
    texto
      // NFD separa "c" da cedilha, "a" do acento agudo, e assim por diante.
      .normalize("NFD")
      // O filtro de ASCII imprimivel remove as marcas combinantes que sobraram.
      .replace(/[^\x20-\x7E]/g, "")
      .trim()
      .slice(0, tamanhoMaximo)
      .toUpperCase()
  );
}

export type ParametrosBrCode = {
  chavePix: string;
  nomeRecebedor: string;
  cidadeRecebedor: string;
  /** EM CENTAVOS. */
  valorCentavos: number;
  /** Identificador da transacao. Apenas letras e digitos, ate 25 caracteres. */
  txid: string;
};

export function montarBrCodePix({
  chavePix,
  nomeRecebedor,
  cidadeRecebedor,
  valorCentavos,
  txid,
}: ParametrosBrCode): string {
  const contaComerciante =
    campo("00", "br.gov.bcb.pix") + campo("01", chavePix);

  const txidLimpo =
    txid.replace(/[^0-9A-Za-z]/g, "").slice(0, 25) || "***";

  const dadosAdicionais = campo("05", txidLimpo);

  const payloadSemCrc =
    campo("00", "01") + // Payload Format Indicator
    campo("01", "12") + // Point of Initiation: uso unico
    campo("26", contaComerciante) + // Merchant Account Information - Pix
    campo("52", "0000") + // Merchant Category Code
    campo("53", "986") + // Moeda: BRL
    campo("54", (valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") + // Pais
    campo("59", normalizarTexto(nomeRecebedor, 25)) +
    campo("60", normalizarTexto(cidadeRecebedor, 15)) +
    campo("62", dadosAdicionais) +
    "6304"; // id e comprimento do CRC entram no calculo

  return payloadSemCrc + crc16(payloadSemCrc);
}
