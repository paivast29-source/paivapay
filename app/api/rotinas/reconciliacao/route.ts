import { NextResponse } from "next/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { aplicarStatusDoPsp } from "@/lib/cobrancas/servico";
import { inicioDeHoje } from "@/lib/datas";
import { db } from "@/lib/db";
import { obterProvedor } from "@/lib/psp";
import { compararSegredos } from "@/lib/token";

/**
 * Reconciliacao diaria (secao 10, regra 4).
 *
 * "Rotina automatica que consulta no PSP todas as cobrancas com status
 *  aguardando_pagamento e corrige divergencias. Webhooks falham; a
 *  reconciliacao e a rede de seguranca."
 *
 * Isto nao e redundancia defensiva: webhook se perde por instabilidade de rede,
 * por deploy no momento errado, por erro de processamento nosso. Sem esta
 * rotina, um pagamento perdido so apareceria quando o cliente reclamasse de ter
 * pago e continuar sendo cobrado.
 *
 * Tambem marca como vencidas as cobrancas cujo prazo passou, para que o painel
 * nao dependa do calculo de exibicao.
 *
 * COMO AGENDAR: em producao, configure um Cron Job da Vercel chamando
 * GET /api/rotinas/reconciliacao uma vez por dia. O arquivo vercel.json na raiz
 * ja traz o agendamento. A rota exige o header `authorization: Bearer <CRON_SECRET>`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(requisicao: Request): boolean {
  const segredo = process.env.CRON_SECRET;

  // Sem segredo configurado a rotina fica fechada. Deixar aberta permitiria que
  // qualquer pessoa disparasse consultas em massa ao PSP.
  if (!segredo) return false;

  const cabecalho = requisicao.headers.get("authorization");
  if (!cabecalho?.startsWith("Bearer ")) return false;

  return compararSegredos(cabecalho.slice(7), segredo);
}

export async function GET(requisicao: Request) {
  if (!autorizado(requisicao)) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const provedor = obterProvedor();
  const hoje = inicioDeHoje();

  const emAberto = await db.cobranca.findMany({
    where: {
      status: { in: ["aguardando_pagamento", "vencido"] },
      idNoPsp: { not: null },
    },
    select: { id: true, idNoPsp: true, status: true, vencimento: true },
  });

  let consultadas = 0;
  let corrigidas = 0;
  let falhas = 0;

  for (const cobranca of emAberto) {
    if (!cobranca.idNoPsp) continue;

    try {
      consultadas++;
      const consulta = await provedor.consultarCobranca(cobranca.idNoPsp);

      const resultado = await aplicarStatusDoPsp({
        idCobrancaNoPsp: cobranca.idNoPsp,
        status: consulta.status,
        pagoEm: consulta.pagoEm,
        valorPago: consulta.valorPago,
        formaPagamento: consulta.formaPagamento,
        origem: "reconciliacao",
      });

      if (resultado.atualizada) {
        corrigidas++;
        console.warn(
          "[reconciliacao] divergencia corrigida:",
          cobranca.id,
          "->",
          consulta.status,
        );
      }
    } catch (erro) {
      falhas++;
      // Uma cobranca que falha nao pode interromper as demais.
      console.error("[reconciliacao] falha ao consultar", cobranca.id, erro);
    }
  }

  // Marca como vencido o que passou do prazo e continua em aberto. Sem isto, o
  // status gravado ficaria eternamente em aguardando_pagamento e so o calculo
  // de exibicao mostraria "vencido".
  const vencidas = await db.cobranca.updateMany({
    where: { status: "aguardando_pagamento", vencimento: { lt: hoje } },
    data: { status: "vencido" },
  });

  const resumo = {
    consultadas,
    corrigidas,
    falhas,
    marcadasVencidas: vencidas.count,
    executadaEm: new Date().toISOString(),
  };

  if (corrigidas > 0 || falhas > 0) {
    await registrarAuditoria({
      acao: "reconciliacao.divergencia",
      entidade: "rotina",
      dadosNovos: resumo,
      ip: null,
    });
  }

  console.info("[reconciliacao] concluida", resumo);

  return NextResponse.json(resumo, { status: 200 });
}
