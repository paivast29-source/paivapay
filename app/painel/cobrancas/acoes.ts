"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuarioEmAcao } from "@/lib/auth/guarda";
import {
  cancelarCobranca as cancelarNoServico,
  criarCobranca as criarNoServico,
} from "@/lib/cobrancas/servico";
import { deValorInputData, inicioDeHoje } from "@/lib/datas";
import { paraCentavos } from "@/lib/dinheiro";

const esquemaItem = z.object({
  descricao: z.string().trim().min(1, "Descreva o item."),
  quantidade: z.number().int().positive("Quantidade precisa ser maior que zero."),
  valorUnitario: z.number().int().positive("Valor precisa ser maior que zero."),
});

export type EstadoCobranca = {
  erro?: string;
  errosPorCampo?: Record<string, string>;
};

/**
 * Cria a cobranca a partir do formulario (fluxo 7.1).
 *
 * Os itens chegam como campos repetidos - item-descricao, item-quantidade,
 * item-valor - e sao remontados aqui. O valor total NAO vem do formulario: e
 * calculado no servidor a partir dos itens, dentro de criarCobranca.
 */
export async function criarCobranca(
  _estadoAnterior: EstadoCobranca,
  dados: FormData,
): Promise<EstadoCobranca> {
  const sessao = await exigirUsuarioEmAcao();
  if (!sessao.ok) return { erro: sessao.erro };

  const clienteId = String(dados.get("clienteId") ?? "");
  if (!clienteId) {
    return { errosPorCampo: { clienteId: "Selecione um cliente." } };
  }

  const descricao = String(dados.get("descricao") ?? "").trim();
  if (descricao.length < 2) {
    return {
      errosPorCampo: { descricao: "Descreva a cobranca em poucas palavras." },
    };
  }

  // ---- Vencimento ----------------------------------------------------------
  const vencimento = deValorInputData(String(dados.get("vencimento") ?? ""));
  if (!vencimento) {
    return { errosPorCampo: { vencimento: "Informe a data de vencimento." } };
  }

  if (vencimento < inicioDeHoje()) {
    return {
      errosPorCampo: {
        vencimento: "O vencimento nao pode ser anterior a hoje.",
      },
    };
  }

  // ---- Formas de pagamento -------------------------------------------------
  const formas = dados.getAll("formasPagamento").map(String);
  const formasValidas = formas.filter((forma): forma is "pix" | "cartao" | "boleto" =>
    ["pix", "cartao", "boleto"].includes(forma),
  );

  if (formasValidas.length === 0) {
    return {
      errosPorCampo: {
        formasPagamento: "Selecione ao menos uma forma de pagamento.",
      },
    };
  }

  // ---- Itens ---------------------------------------------------------------
  const descricoes = dados.getAll("item-descricao").map(String);
  const quantidades = dados.getAll("item-quantidade").map(String);
  const valores = dados.getAll("item-valor").map(String);

  const itens: { descricao: string; quantidade: number; valorUnitario: number }[] =
    [];

  for (let indice = 0; indice < descricoes.length; indice++) {
    const descricaoItem = descricoes[indice]?.trim() ?? "";
    // Linha totalmente vazia e ignorada: o formulario comeca com uma linha em
    // branco e o usuario pode deixar sobrando.
    if (!descricaoItem && !valores[indice]?.trim()) continue;

    const quantidade = Number.parseInt(quantidades[indice] ?? "1", 10);
    const valorUnitario = paraCentavos(valores[indice] ?? "");

    if (valorUnitario === null) {
      return {
        errosPorCampo: {
          itens: `Valor invalido no item ${indice + 1}. Use o formato 1.234,56.`,
        },
      };
    }

    const analise = esquemaItem.safeParse({
      descricao: descricaoItem,
      quantidade,
      valorUnitario,
    });

    if (!analise.success) {
      return {
        errosPorCampo: {
          itens: `Item ${indice + 1}: ${analise.error.issues[0].message}`,
        },
      };
    }

    itens.push(analise.data);
  }

  if (itens.length === 0) {
    return { errosPorCampo: { itens: "Inclua ao menos um item." } };
  }

  const resultado = await criarNoServico({
    clienteId,
    descricao,
    itens,
    vencimento,
    formasPagamentoAceitas: formasValidas,
    usuarioId: sessao.usuario.id,
  });

  if (!resultado.ok) {
    return { erro: resultado.erro };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/cobrancas");
  redirect(`/painel/cobrancas/${resultado.cobrancaId}?criada=1`);
}

export async function cancelarCobranca(dados: FormData) {
  const sessao = await exigirUsuarioEmAcao();
  if (!sessao.ok) return;

  const cobrancaId = String(dados.get("cobrancaId") ?? "");
  if (!cobrancaId) return;

  await cancelarNoServico(cobrancaId, sessao.usuario.id);

  revalidatePath("/painel");
  revalidatePath("/painel/cobrancas");
  revalidatePath(`/painel/cobrancas/${cobrancaId}`);
}
