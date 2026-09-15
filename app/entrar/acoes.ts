"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  configuracaoRateLimit,
  limparTentativas,
  registrarTentativa,
  verificarRateLimit,
} from "@/lib/auth/rate-limit";
import { conferirSenha, gerarHashSenha } from "@/lib/auth/senha";
import { criarSessao, encerrarSessao, obterIp } from "@/lib/auth/sessao";
import { db } from "@/lib/db";

/**
 * Autenticacao do painel.
 *
 * Server Actions do Next ja trazem protecao contra CSRF: o framework compara a
 * origem da requisicao com o host e recusa chamadas cross-site. Somado ao
 * cookie SameSite=Lax de lib/auth/sessao.ts, cobre o item "protecao contra CSRF
 * em todos os formularios do painel" da secao 11.
 */

const esquemaEntrada = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail valido."),
  senha: z.string().min(1, "Informe a senha."),
});

export type EstadoEntrada = { erro?: string };

/**
 * Hash descartavel usado para equalizar o tempo de resposta quando o e-mail nao
 * existe.
 *
 * Sem isso, "e-mail inexistente" responderia na hora e "senha errada" levaria
 * os ~50ms do argon2 - e essa diferenca por si so revela quais e-mails tem
 * conta. Precisa ser um hash argon2 de verdade: uma string invalida faria o
 * verify falhar de imediato e nao gastaria tempo nenhum.
 *
 * Gerado uma vez por processo e reaproveitado.
 */
let hashDescartavel: Promise<string> | null = null;

function obterHashDescartavel(): Promise<string> {
  hashDescartavel ??= gerarHashSenha(
    `descartavel-${Math.random().toString(36)}`,
  );
  return hashDescartavel;
}

export async function entrar(
  _estadoAnterior: EstadoEntrada,
  dados: FormData,
): Promise<EstadoEntrada> {
  const analise = esquemaEntrada.safeParse({
    email: dados.get("email"),
    senha: dados.get("senha"),
  });

  if (!analise.success) {
    return { erro: analise.error.issues[0].message };
  }

  const { email, senha } = analise.data;
  const ip = await obterIp();

  // ---- Rate limiting (secao 11) -------------------------------------------
  // A chave e o e-mail, e nao o IP: um escritorio inteiro atras do mesmo IP
  // nao pode bloquear os colegas, e o alvo real do ataque e a conta.
  const limite = await verificarRateLimit(email);

  if (limite.bloqueado) {
    const minutos = limite.liberaEm
      ? Math.max(
          1,
          Math.ceil((limite.liberaEm.getTime() - Date.now()) / 60000),
        )
      : configuracaoRateLimit.janelaMinutos;

    return {
      erro: `Muitas tentativas. Tente novamente em ${minutos} minuto${minutos > 1 ? "s" : ""}.`,
    };
  }

  const usuario = await db.usuario.findUnique({
    where: { email },
    select: { id: true, senhaHash: true, ativo: true },
  });

  // Mesma mensagem para "e-mail inexistente" e "senha errada". Diferenciar
  // permitiria descobrir quais e-mails tem conta no sistema.
  const mensagemGenerica = "E-mail ou senha incorretos.";

  if (!usuario || !usuario.ativo) {
    await registrarTentativa(email, false, ip);
    // Gasta o mesmo tempo de um argon2 real, para que a resposta nao denuncie
    // se a conta existe.
    await conferirSenha(await obterHashDescartavel(), senha);
    return { erro: mensagemGenerica };
  }

  const senhaCorreta = await conferirSenha(usuario.senhaHash, senha);

  if (!senhaCorreta) {
    await registrarTentativa(email, false, ip);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "usuario.login_falhou",
      entidade: "usuario",
      entidadeId: usuario.id,
      ip,
    });
    return { erro: mensagemGenerica };
  }

  // ---- Sucesso -------------------------------------------------------------
  await registrarTentativa(email, true, ip);
  await limparTentativas(email);

  await criarSessao(usuario.id);

  await db.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "usuario.login",
    entidade: "usuario",
    entidadeId: usuario.id,
    ip,
  });

  redirect("/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/entrar");
}
