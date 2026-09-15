import { NextResponse } from "next/server";
import { statusExibicao } from "@/lib/cobrancas/status";
import { db } from "@/lib/db";

/**
 * Consulta de status para o polling da pagina publica (secao 8.2).
 *
 * "A tela faz polling a cada 5 segundos consultando o status; quando confirma,
 *  troca para a tela de sucesso automaticamente."
 *
 * ESTE ENDPOINT SO LE. Ele nunca escreve, nunca chama o PSP e nunca confirma
 * pagamento - secao 10, regra 1: a confirmacao vem apenas do backend, por
 * webhook validado ou consulta direta do servidor ao PSP. O navegador recebe
 * somente o reflexo do que ja foi decidido no servidor.
 *
 * A resposta e deliberadamente minima: status e data de pagamento. Como a rota
 * e publica e acessivel por quem tiver o link, ela nao expoe valor, dados do
 * cliente, nem qualquer identificador interno.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Um token fora do formato esperado nem chega ao banco.
  if (!token || token.length < 32 || token.length > 128) {
    return NextResponse.json({ erro: "token invalido" }, { status: 404 });
  }

  const cobranca = await db.cobranca.findUnique({
    where: { tokenPublico: token },
    select: { status: true, vencimento: true, pagoEm: true },
  });

  if (!cobranca) {
    return NextResponse.json({ erro: "nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: statusExibicao(cobranca),
      pagoEm: cobranca.pagoEm?.toISOString() ?? null,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
