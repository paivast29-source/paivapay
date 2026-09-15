"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { criarCliente, type EstadoCliente } from "@/app/painel/clientes/acoes";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { AvisoErro, Campo, CampoSelecao } from "@/components/ui/campo";
import { formatarDocumento, limparDocumento } from "@/lib/documento";

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar cliente"}
    </Botao>
  );
}

export function FormularioCliente() {
  const [estado, acao] = useActionState<EstadoCliente, FormData>(
    criarCliente,
    {},
  );

  const [tipo, setTipo] = useState<"pf" | "pj">("pf");
  const [documento, setDocumento] = useState("");

  const limiteDocumento = tipo === "pf" ? 11 : 14;

  function aoDigitarDocumento(valor: string) {
    // Mascara aplicada na digitacao; o servidor recebe e limpa de novo, entao
    // isto e conforto de uso, nunca validacao.
    const limpo = limparDocumento(valor).slice(0, limiteDocumento);
    setDocumento(formatarDocumento(limpo));
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}

      <CampoSelecao
        rotulo="Tipo de cliente"
        name="tipo"
        value={tipo}
        onChange={(evento) => {
          setTipo(evento.target.value as "pf" | "pj");
          setDocumento("");
        }}
      >
        <option value="pf">Pessoa fisica</option>
        <option value="pj">Pessoa juridica</option>
      </CampoSelecao>

      <Campo
        rotulo={tipo === "pf" ? "Nome completo" : "Razao social"}
        name="nome"
        required
        autoComplete="off"
        erro={estado.errosPorCampo?.nome}
        placeholder={tipo === "pf" ? "Maria da Silva" : "Empresa Exemplo Ltda"}
      />

      <Campo
        rotulo={tipo === "pf" ? "CPF" : "CNPJ"}
        name="documento"
        required
        inputMode={tipo === "pf" ? "numeric" : "text"}
        value={documento}
        onChange={(evento) => aoDigitarDocumento(evento.target.value)}
        erro={estado.errosPorCampo?.documento}
        placeholder={tipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
        dica={
          tipo === "pj"
            ? "Aceita CNPJ numerico e tambem o alfanumerico, emitido a partir de 2026."
            : undefined
        }
      />

      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        required
        autoComplete="off"
        erro={estado.errosPorCampo?.email}
        placeholder="cliente@exemplo.com.br"
        dica="Para onde a cobranca e o recibo serao enviados."
      />

      <Campo
        rotulo="Telefone"
        name="telefone"
        type="tel"
        autoComplete="off"
        erro={estado.errosPorCampo?.telefone}
        placeholder="(11) 99999-0000"
        dica="Opcional."
      />

      {/* Secao 11: o consentimento fica registrado com data no cadastro. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-borda bg-fundo p-3">
        <input
          type="checkbox"
          name="consentimentoEmail"
          defaultChecked
          className="mt-0.5 size-4 accent-[var(--cor-marca)]"
        />
        <span className="text-sm text-grafite">
          O cliente autoriza receber cobrancas, lembretes e recibos por e-mail.
          <span className="mt-0.5 block text-xs text-secundario">
            A data desta autorizacao fica registrada no cadastro, conforme a
            LGPD.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <BotaoSalvar />
        <BotaoLink href="/painel/clientes" variante="secundario">
          Cancelar
        </BotaoLink>
      </div>
    </form>
  );
}
