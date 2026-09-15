import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { aplicarStatusDoPsp } from "@/lib/cobrancas/servico";
import { db } from "@/lib/db";
import { obterProvedor, sanitizarPayload } from "@/lib/psp";

/**
 * Recepcao de webhooks do provedor de pagamentos.
 *
 * Esta rota e o unico caminho pelo qual uma cobranca vira "paga" no fluxo
 * normal (a reconciliacao diaria e a rede de seguranca). Tres regras da secao
 * 10 se encontram aqui:
 *
 *   Regra 1 - a confirmacao vem apenas do backend. Nenhum sinal do navegador
 *             marca cobranca como paga. O polling da pagina publica so LE o
 *             status; quem escreve e este endpoint.
 *
 *   Regra 2 - todo webhook e validado. Requisicao sem assinatura valida e
 *             descartada e registrada.
 *
 *   Regra 3 - webhooks sao idempotentes. id_evento_psp tem restricao de
 *             unicidade no banco; o evento repetido e ignorado. Sem isso o
 *             cliente recebe dois recibos e o relatorio conta o valor em dobro.
 */

// Dados financeiros: nunca servir de cache.
export const dynamic = "force-dynamic";

export async function POST(requisicao: Request) {
  const provedor = obterProvedor();

  // O corpo precisa ser lido como texto cru: provedores que assinam por HMAC
  // calculam a assinatura sobre os bytes exatos. Reserializar o JSON mudaria a
  // ordem das chaves e quebraria a verificacao.
  const corpoBruto = await requisicao.text();

  // ---- Regra 2: validacao da assinatura ------------------------------------
  const validacao = provedor.validarAssinaturaWebhook(
    requisicao.headers,
    corpoBruto,
  );

  if (!validacao.valido) {
    console.warn("[webhook] rejeitado:", validacao.motivo);

    await registrarAuditoria({
      acao: "webhook.rejeitado",
      entidade: "webhook",
      dadosNovos: {
        motivo: validacao.motivo,
        // Apenas um trecho, o suficiente para investigar sem guardar lixo.
        trecho: corpoBruto.slice(0, 500),
      } as Prisma.InputJsonValue,
      ip:
        requisicao.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    });

    return NextResponse.json(
      { erro: "assinatura invalida" },
      { status: 401 },
    );
  }

  // ---- Interpretacao -------------------------------------------------------
  let payload: unknown;
  try {
    payload = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ erro: "corpo nao e JSON" }, { status: 400 });
  }

  const evento = provedor.interpretarWebhook(payload);

  if (!evento) {
    // Formato desconhecido. Respondemos 200 de proposito: devolver erro faria o
    // PSP reenviar indefinidamente algo que nunca vamos conseguir processar.
    console.warn("[webhook] payload nao reconhecido");
    return NextResponse.json({ ignorado: true }, { status: 200 });
  }

  // ---- Regra 3: idempotencia ----------------------------------------------
  // A unicidade de id_evento_psp e garantida pelo banco, nao por uma consulta
  // previa. Consultar antes de inserir abriria uma janela de corrida: dois
  // envios simultaneos do mesmo evento passariam os dois pela verificacao.
  try {
    await db.eventoWebhook.create({
      data: {
        idEventoPsp: evento.idEventoPsp,
        tipo: evento.tipo,
        payload: sanitizarPayload(payload) as Prisma.InputJsonValue,
        processado: false,
      },
    });
  } catch (erro) {
    if (
      !(
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002"
      )
    ) {
      throw erro;
    }

    // Ja tinhamos visto este evento. Duas situacoes diferentes se escondem aqui:
    //
    //  - processado = true  -> reenvio de um evento que ja surtiu efeito.
    //                          Ignorar e exatamente o que a regra 3 pede.
    //
    //  - processado = false -> a tentativa anterior gravou o evento mas falhou
    //                          no meio do processamento, e o PSP esta
    //                          reenviando por causa do nosso 500. Precisa ser
    //                          processado agora; tratar como duplicado deixaria
    //                          um pagamento confirmado sem nunca aparecer no
    //                          painel.
    const existente = await db.eventoWebhook.findUnique({
      where: { idEventoPsp: evento.idEventoPsp },
      select: { processado: true },
    });

    if (existente?.processado) {
      console.info("[webhook] evento repetido ignorado:", evento.idEventoPsp);
      return NextResponse.json({ duplicado: true }, { status: 200 });
    }

    console.warn(
      "[webhook] reprocessando evento que falhou antes:",
      evento.idEventoPsp,
    );
  }

  // ---- Processamento -------------------------------------------------------
  try {
    if (evento.status && evento.idCobrancaNoPsp) {
      const resultado = await aplicarStatusDoPsp({
        idCobrancaNoPsp: evento.idCobrancaNoPsp,
        status: evento.status,
        pagoEm: evento.pagoEm,
        valorPago: evento.valorPago,
        formaPagamento: evento.formaPagamento,
        origem: "webhook",
        payloadBruto: payload,
      });

      if (!resultado.atualizada) {
        console.info("[webhook] sem alteracao:", resultado.motivo);
      }
    }

    await db.eventoWebhook.update({
      where: { idEventoPsp: evento.idEventoPsp },
      data: { processado: true, processadoEm: new Date() },
    });

    return NextResponse.json({ recebido: true }, { status: 200 });
  } catch (erro) {
    // O evento fica gravado com processado=false e a mensagem de erro, para
    // reprocessamento manual. Respondemos 500 para que o PSP tente de novo.
    console.error("[webhook] falha ao processar", evento.idEventoPsp, erro);

    await db.eventoWebhook
      .update({
        where: { idEventoPsp: evento.idEventoPsp },
        data: { erro: erro instanceof Error ? erro.message : String(erro) },
      })
      .catch(() => {});

    return NextResponse.json(
      { erro: "falha ao processar" },
      { status: 500 },
    );
  }
}
