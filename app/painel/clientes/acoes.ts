"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirUsuarioEmAcao } from "@/lib/auth/guarda";
import { db } from "@/lib/db";
import { limparDocumento, validarDocumento } from "@/lib/documento";

const esquemaCliente = z
  .object({
    tipo: z.enum(["pf", "pj"]),
    nome: z.string().trim().min(2, "Informe o nome ou a razao social."),
    documento: z.string().trim().min(1, "Informe o CPF ou CNPJ."),
    email: z.string().trim().toLowerCase().email("Informe um e-mail valido."),
    telefone: z.string().trim().optional(),
    // Secao 11: registro do consentimento de comunicacao por e-mail.
    consentimentoEmail: z.boolean(),
  })
  .refine((dados) => validarDocumento(dados.documento, dados.tipo), {
    path: ["documento"],
    message: "Documento invalido. Confira os digitos.",
  });

export type EstadoCliente = {
  erro?: string;
  errosPorCampo?: Record<string, string>;
};

function lerFormulario(dados: FormData) {
  return {
    tipo: dados.get("tipo"),
    nome: dados.get("nome"),
    documento: dados.get("documento"),
    email: dados.get("email"),
    telefone: dados.get("telefone") || undefined,
    consentimentoEmail: dados.get("consentimentoEmail") === "on",
  };
}

export async function criarCliente(
  _estadoAnterior: EstadoCliente,
  dados: FormData,
): Promise<EstadoCliente> {
  const sessao = await exigirUsuarioEmAcao();
  if (!sessao.ok) return { erro: sessao.erro };

  const analise = esquemaCliente.safeParse(lerFormulario(dados));

  if (!analise.success) {
    const errosPorCampo: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const campo = String(problema.path[0] ?? "");
      errosPorCampo[campo] ??= problema.message;
    }
    return { errosPorCampo };
  }

  const entrada = analise.data;
  // Gravado somente com os caracteres significativos; a mascara e so exibicao.
  const documento = limparDocumento(entrada.documento);

  const jaExiste = await db.cliente.findUnique({ where: { documento } });
  if (jaExiste) {
    return {
      errosPorCampo: {
        documento: `Ja existe um cliente cadastrado com este documento: ${jaExiste.nome}.`,
      },
    };
  }

  const cliente = await db.cliente.create({
    data: {
      tipo: entrada.tipo,
      nome: entrada.nome,
      documento,
      email: entrada.email,
      telefone: entrada.telefone || null,
      consentimentoEmail: entrada.consentimentoEmail,
      consentimentoEmailEm: entrada.consentimentoEmail ? new Date() : null,
    },
  });

  await registrarAuditoria({
    usuarioId: sessao.usuario.id,
    acao: "cliente.criado",
    entidade: "cliente",
    entidadeId: cliente.id,
    dadosNovos: {
      nome: cliente.nome,
      documento: cliente.documento,
      email: cliente.email,
    },
  });

  revalidatePath("/painel/clientes");
  redirect(`/painel/clientes/${cliente.id}`);
}
