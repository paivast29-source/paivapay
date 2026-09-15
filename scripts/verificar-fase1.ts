/**
 * Verificacao ponta a ponta da Fase 1.
 *
 * Exercita, contra o servidor rodando, as regras criticas da secao 10 da
 * especificacao - as que "causam prejuizo financeiro real" quando erradas:
 *
 *   regra 1 - confirmacao de pagamento vem apenas do backend
 *   regra 2 - todo webhook e validado
 *   regra 3 - webhooks sao idempotentes
 *   regra 5 - token publico aleatorio, sem id sequencial
 *   regra 6 - valores em centavos, inteiro
 *   regra 8 - log de auditoria
 *
 * COMO RODAR:
 *   1. npm run dev        (em um terminal)
 *   2. npm run verificar  (em outro)
 *
 * Usa o provider mock. Nao toca em dinheiro real e limpa os dados que cria.
 */
// O .env e carregado pela flag --env-file do Node, definida no script npm.
// Precisa ser antes dos imports: lib/psp/mock puxa lib/db, que le DATABASE_URL
// no momento em que o modulo e avaliado - e isso acontece antes de qualquer
// linha do corpo deste arquivo rodar.
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { provedorMock } from "../lib/psp/mock";
import { gerarTokenPublico } from "../lib/token";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BASE = process.env.APP_URL || "http://localhost:3000";
const TOKEN_WEBHOOK = process.env.ASAAS_WEBHOOK_TOKEN || "mock-webhook-token";

let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) {
    console.log(`  [OK]    ${nome}`);
  } else {
    falhas++;
    console.log(`  [FALHA] ${nome} ${detalhe}`);
  }
}

async function main() {
  console.log("\n=== Preparando dados de teste ===");

  const conta = await db.contaRecebedora.findFirstOrThrow({
    where: { padrao: true },
  });
  const usuario = await db.usuario.findFirstOrThrow();

  // CPF ficticio apenas para satisfazer a unicidade; nao passa por validacao
  // aqui porque o alvo do teste e o fluxo de pagamento.
  const documento = String(
    Math.floor(Math.random() * 90000000000) + 10000000000,
  );

  const cliente = await db.cliente.create({
    data: {
      tipo: "pf",
      nome: "Cliente de Teste",
      documento,
      email: "teste@exemplo.com.br",
      consentimentoEmail: true,
      consentimentoEmailEm: new Date(),
    },
  });

  const VALOR = 123456; // R$ 1.234,56 EM CENTAVOS
  const tokenPublico = gerarTokenPublico();
  const vencimento = new Date(Date.now() + 7 * 86400000);

  const cobranca = await db.cobranca.create({
    data: {
      clienteId: cliente.id,
      contaRecebedoraId: conta.id,
      tokenPublico,
      descricao: "Cobranca de verificacao",
      valorTotal: VALOR,
      vencimento,
      status: "rascunho",
      formasPagamentoAceitas: ["pix", "boleto"],
      criadoPor: usuario.id,
      itens: {
        create: [
          {
            descricao: "Item teste",
            quantidade: 1,
            valorUnitario: VALOR,
            valorTotal: VALOR,
          },
        ],
      },
      eventos: { create: { tipo: "criada" } },
    },
  });

  const respostaPsp = await provedorMock.criarCobranca({
    clienteIdNoPsp: "mock_cli_teste",
    valorTotal: VALOR,
    vencimento,
    descricao: "Cobranca de verificacao",
    formasPagamentoAceitas: ["pix", "boleto"],
    referenciaExterna: cobranca.id,
  });

  await db.cobranca.update({
    where: { id: cobranca.id },
    data: {
      idNoPsp: respostaPsp.idNoPsp,
      dadosPagamento: respostaPsp.dadosPagamento as Prisma.InputJsonValue,
      status: "aguardando_pagamento",
    },
  });

  console.log(`  cobranca: ${cobranca.id}`);
  console.log(`  id no psp: ${respostaPsp.idNoPsp}`);

  // -------------------------------------------------------------------------
  console.log("\n=== 1. Pagina publica de pagamento (secao 8.2) ===");

  const paginaPublica = await fetch(`${BASE}/pagar/${tokenPublico}`);
  const html = await paginaPublica.text();

  checar("responde 200", paginaPublica.status === 200, `(${paginaPublica.status})`);
  checar("exibe o valor em reais", html.includes("1.234,56"));
  checar("exibe a descricao", html.includes("Cobranca de verificacao"));
  checar("exibe o QR Code do Pix", html.includes("data:image/png;base64"));
  checar("exibe o codigo copia-e-cola", html.includes("br.gov.bcb.pix"));

  // -------------------------------------------------------------------------
  console.log("\n=== 2. Token publico aleatorio (regra 5) ===");

  checar(
    "token com no minimo 32 caracteres",
    tokenPublico.length >= 32,
    `(${tokenPublico.length})`,
  );
  checar("token nao e numerico sequencial", !/^\d+$/.test(tokenPublico));

  const paginaInvalida = await fetch(`${BASE}/pagar/${"x".repeat(64)}`);
  checar(
    "link inexistente devolve 404",
    paginaInvalida.status === 404,
    `(${paginaInvalida.status})`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== 3. Endpoint de polling ===");

  const statusAntes = await (
    await fetch(`${BASE}/api/pagar/${tokenPublico}/status`)
  ).json();

  checar(
    "status inicial aguardando_pagamento",
    statusAntes.status === "aguardando_pagamento",
    JSON.stringify(statusAntes),
  );
  checar(
    "nao expoe valor nem dados do cliente",
    !("valorTotal" in statusAntes) && !("cliente" in statusAntes),
  );

  // -------------------------------------------------------------------------
  console.log("\n=== 4. Webhook sem assinatura valida (regra 2) ===");

  const payloadEvento = {
    id: `evt_teste_${randomUUID()}`,
    event: "PAYMENT_RECEIVED",
    payment: {
      id: respostaPsp.idNoPsp,
      status: "RECEIVED",
      value: VALOR / 100,
      billingType: "PIX",
      paymentDate: new Date().toISOString(),
    },
  };

  async function enviarWebhook(token: string | null) {
    const cabecalhos: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) cabecalhos["asaas-access-token"] = token;

    return fetch(`${BASE}/api/webhooks/asaas`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(payloadEvento),
    });
  }

  const semToken = await enviarWebhook(null);
  checar("sem token: 401", semToken.status === 401, `(${semToken.status})`);

  const tokenErrado = await enviarWebhook("token-errado");
  checar(
    "token errado: 401",
    tokenErrado.status === 401,
    `(${tokenErrado.status})`,
  );

  const aindaAguardando = await (
    await fetch(`${BASE}/api/pagar/${tokenPublico}/status`)
  ).json();
  checar(
    "cobranca NAO foi paga por webhook invalido",
    aindaAguardando.status === "aguardando_pagamento",
  );

  // -------------------------------------------------------------------------
  console.log("\n=== 5. Webhook valido confirma o pagamento (regra 1) ===");

  const valido = await enviarWebhook(TOKEN_WEBHOOK);
  checar("webhook valido: 200", valido.status === 200, `(${valido.status})`);

  const depois = await (
    await fetch(`${BASE}/api/pagar/${tokenPublico}/status`)
  ).json();
  checar("status passou para pago", depois.status === "pago", JSON.stringify(depois));
  checar("data de pagamento registrada", Boolean(depois.pagoEm));

  const noBanco = await db.cobranca.findUniqueOrThrow({
    where: { id: cobranca.id },
    include: { transacoes: true },
  });
  checar("gravado como pago no banco", noBanco.status === "pago");
  checar(
    "uma transacao confirmada",
    noBanco.transacoes.length === 1,
    `(${noBanco.transacoes.length})`,
  );
  checar(
    "valor da transacao em centavos, inteiro (regra 6)",
    noBanco.transacoes[0]?.valor === VALOR &&
      Number.isInteger(noBanco.transacoes[0]?.valor),
    `(${noBanco.transacoes[0]?.valor})`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== 6. Idempotencia (regra 3) ===");

  const repetido = await enviarWebhook(TOKEN_WEBHOOK);
  const corpoRepetido = await repetido.json();

  checar("evento repetido: 200", repetido.status === 200);
  checar(
    "reconhecido como duplicado",
    corpoRepetido.duplicado === true,
    JSON.stringify(corpoRepetido),
  );

  const aposRepeticao = await db.cobranca.findUniqueOrThrow({
    where: { id: cobranca.id },
    include: { transacoes: true },
  });
  checar(
    "NAO duplicou a transacao (relatorio nao conta em dobro)",
    aposRepeticao.transacoes.length === 1,
    `(${aposRepeticao.transacoes.length} transacoes)`,
  );

  const eventosGravados = await db.eventoWebhook.count({
    where: { idEventoPsp: payloadEvento.id },
  });
  checar("evento gravado uma unica vez", eventosGravados === 1, `(${eventosGravados})`);

  // -------------------------------------------------------------------------
  console.log("\n=== 7. Pagina publica no estado 'ja paga' (secao 8.2) ===");

  const htmlPago = await (await fetch(`${BASE}/pagar/${tokenPublico}`)).text();
  checar("mostra confirmacao de pagamento", htmlPago.includes("Pagamento confirmado"));
  checar("nao mostra mais o checkout do Pix", !htmlPago.includes("Copiar codigo Pix"));

  // -------------------------------------------------------------------------
  console.log("\n=== 8. Auditoria (regra 8) ===");

  const auditoria = await db.logAuditoria.findMany({
    where: { entidadeId: cobranca.id },
  });
  checar(
    "pagamento registrado em auditoria",
    auditoria.some((linha) => linha.acao === "cobranca.paga"),
  );

  const rejeicoes = await db.logAuditoria.count({
    where: { acao: "webhook.rejeitado" },
  });
  checar("webhooks rejeitados registrados", rejeicoes >= 2, `(${rejeicoes})`);

  // -------------------------------------------------------------------------
  console.log("\n=== Limpando ===");
  await db.logAuditoria.deleteMany({ where: { entidadeId: cobranca.id } });
  await db.eventoWebhook.deleteMany({
    where: { idEventoPsp: payloadEvento.id },
  });
  await db.cobranca.delete({ where: { id: cobranca.id } });
  await db.cliente.delete({ where: { id: cliente.id } });
  console.log("  dados de teste removidos");

  console.log(
    falhas === 0
      ? "\n============ TODAS AS VERIFICACOES PASSARAM ============\n"
      : `\n============ ${falhas} VERIFICACAO(OES) FALHARAM ============\n`,
  );

  await db.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {
  console.error("\nerro na verificacao:", erro);
  await db.$disconnect();
  process.exit(1);
});
