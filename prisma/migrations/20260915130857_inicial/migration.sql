-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('diretor', 'operacional');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('pf', 'pj');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('rascunho', 'aguardando_pagamento', 'pago', 'vencido', 'cancelado', 'estornado');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('pix', 'cartao', 'boleto');

-- CreateEnum
CREATE TYPE "StatusTransacao" AS ENUM ('pendente', 'confirmada', 'falhou', 'estornada');

-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('mensal', 'trimestral', 'anual');

-- CreateEnum
CREATE TYPE "TipoEventoCobranca" AS ENUM ('criada', 'enviada', 'visualizada', 'paga', 'vencida', 'cancelada', 'estornada', 'lembrete_enviado', 'recibo_enviado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'operacional',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acesso" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentativas_login" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "ip" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativas_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" JSONB,
    "id_no_psp" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "consentimento_email" BOOLEAN NOT NULL DEFAULT false,
    "consentimento_email_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_recebedoras" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "id_no_psp" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_recebedoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "conta_recebedora_id" TEXT NOT NULL,
    "token_publico" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_total" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'rascunho',
    "formas_pagamento_aceitas" "FormaPagamento"[],
    "id_no_psp" TEXT,
    "dados_pagamento" JSONB,
    "recorrencia_id" TEXT,
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_em" TIMESTAMP(3),
    "cancelado_em" TIMESTAMP(3),

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_cobranca" (
    "id" TEXT NOT NULL,
    "cobranca_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "valor_unitario" INTEGER NOT NULL,
    "valor_total" INTEGER NOT NULL,

    CONSTRAINT "itens_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_cobranca" (
    "id" TEXT NOT NULL,
    "cobranca_id" TEXT NOT NULL,
    "tipo" "TipoEventoCobranca" NOT NULL,
    "descricao" TEXT,
    "metadados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recorrencias" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "id" TEXT NOT NULL,
    "cobranca_id" TEXT NOT NULL,
    "forma_pagamento" "FormaPagamento" NOT NULL,
    "valor" INTEGER NOT NULL,
    "status" "StatusTransacao" NOT NULL DEFAULT 'pendente',
    "id_no_psp" TEXT,
    "payload_bruto" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_webhook" (
    "id" TEXT NOT NULL,
    "id_evento_psp" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "processado_em" TIMESTAMP(3),
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "ip" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "sessoes_expira_em_idx" ON "sessoes"("expira_em");

-- CreateIndex
CREATE INDEX "tentativas_login_chave_ocorrido_em_idx" ON "tentativas_login"("chave", "ocorrido_em");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_token_publico_key" ON "cobrancas"("token_publico");

-- CreateIndex
CREATE INDEX "cobrancas_status_idx" ON "cobrancas"("status");

-- CreateIndex
CREATE INDEX "cobrancas_vencimento_idx" ON "cobrancas"("vencimento");

-- CreateIndex
CREATE INDEX "cobrancas_cliente_id_idx" ON "cobrancas"("cliente_id");

-- CreateIndex
CREATE INDEX "cobrancas_criado_em_idx" ON "cobrancas"("criado_em");

-- CreateIndex
CREATE INDEX "itens_cobranca_cobranca_id_idx" ON "itens_cobranca"("cobranca_id");

-- CreateIndex
CREATE INDEX "eventos_cobranca_cobranca_id_criado_em_idx" ON "eventos_cobranca"("cobranca_id", "criado_em");

-- CreateIndex
CREATE INDEX "recorrencias_cliente_id_idx" ON "recorrencias"("cliente_id");

-- CreateIndex
CREATE INDEX "transacoes_cobranca_id_idx" ON "transacoes"("cobranca_id");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_id_evento_psp_key" ON "eventos_webhook"("id_evento_psp");

-- CreateIndex
CREATE INDEX "eventos_webhook_processado_idx" ON "eventos_webhook"("processado");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidade_id_idx" ON "logs_auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_criado_em_idx" ON "logs_auditoria"("criado_em");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_conta_recebedora_id_fkey" FOREIGN KEY ("conta_recebedora_id") REFERENCES "contas_recebedoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_recorrencia_id_fkey" FOREIGN KEY ("recorrencia_id") REFERENCES "recorrencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_cobranca" ADD CONSTRAINT "itens_cobranca_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_cobranca" ADD CONSTRAINT "eventos_cobranca_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencias" ADD CONSTRAINT "recorrencias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
