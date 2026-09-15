import { obterUsuarioSessao } from "@/lib/auth/sessao";
import { deValorInputData, formatarData, inicioDoMes } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoedaSemSimbolo } from "@/lib/dinheiro";
import { formatarDocumento } from "@/lib/documento";

/**
 * Exportacao do relatorio de recebimentos em CSV (secao 8.1).
 *
 * Restrito a diretores (secao 6.1). A verificacao e feita aqui dentro, e nao
 * apenas na tela: uma rota de API e acessivel diretamente pela URL, entao
 * confiar no controle da pagina deixaria o dado consolidado exposto a qualquer
 * usuario autenticado.
 */

export const dynamic = "force-dynamic";

/**
 * Escapa um campo para CSV.
 *
 * Alem das aspas e do separador, neutralizamos formulas: uma celula iniciada
 * por = + - @ e executada pelo Excel ao abrir o arquivo. Como a descricao vem
 * de texto digitado no painel, prefixamos com apostrofo - e o CSV injection.
 */
function campoCsv(valor: string | number | null | undefined): string {
  const texto = String(valor ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export async function GET(requisicao: Request) {
  const usuario = await obterUsuarioSessao();

  if (!usuario) {
    return new Response("nao autenticado", { status: 401 });
  }

  if (usuario.papel !== "diretor") {
    return new Response("acesso restrito a diretores", { status: 403 });
  }

  const url = new URL(requisicao.url);
  const dataInicio =
    deValorInputData(url.searchParams.get("de") ?? "") ?? inicioDoMes();
  const dataFim = deValorInputData(url.searchParams.get("ate") ?? "") ?? new Date();

  const fimDoDia = new Date(dataFim);
  fimDoDia.setHours(23, 59, 59, 999);

  const pagamentos = await db.cobranca.findMany({
    where: { status: "pago", pagoEm: { gte: dataInicio, lte: fimDoDia } },
    orderBy: { pagoEm: "asc" },
    select: {
      descricao: true,
      valorTotal: true,
      pagoEm: true,
      vencimento: true,
      cliente: { select: { nome: true, documento: true } },
      transacoes: {
        where: { status: "confirmada" },
        select: { formaPagamento: true },
        take: 1,
      },
    },
  });

  const cabecalho = [
    "Data do pagamento",
    "Vencimento",
    "Cliente",
    "Documento",
    "Descricao",
    "Forma de pagamento",
    "Valor (R$)",
  ];

  const linhas = pagamentos.map((pagamento) =>
    [
      campoCsv(pagamento.pagoEm ? formatarData(pagamento.pagoEm) : ""),
      campoCsv(formatarData(pagamento.vencimento)),
      campoCsv(pagamento.cliente.nome),
      campoCsv(formatarDocumento(pagamento.cliente.documento)),
      campoCsv(pagamento.descricao),
      campoCsv(pagamento.transacoes[0]?.formaPagamento ?? ""),
      // Formato brasileiro, para o Excel em pt-BR reconhecer como numero.
      campoCsv(formatarMoedaSemSimbolo(pagamento.valorTotal)),
    ].join(";"),
  );

  const total = pagamentos.reduce((soma, p) => soma + p.valorTotal, 0);

  const conteudo = [
    cabecalho.map(campoCsv).join(";"),
    ...linhas,
    "",
    [campoCsv("TOTAL"), "", "", "", "", "", campoCsv(formatarMoedaSemSimbolo(total))].join(";"),
  ].join("\r\n");

  // BOM UTF-8: sem ele o Excel no Windows abre acentuacao corrompida.
  const corpo = `﻿${conteudo}`;

  const nomeArquivo = `recebimentos-${url.searchParams.get("de") ?? ""}-a-${url.searchParams.get("ate") ?? ""}.csv`;

  return new Response(corpo, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
