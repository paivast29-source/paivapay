"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoEntrada } from "@/app/entrar/acoes";
import { Botao } from "@/components/ui/botao";
import { AvisoErro, Campo } from "@/components/ui/campo";

function BotaoEntrar() {
  // useFormStatus precisa estar em um componente filho do <form> para enxergar
  // o estado de envio.
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" larguraTotal disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Botao>
  );
}

export function FormularioEntrada() {
  const [estado, acao] = useActionState<EstadoEntrada, FormData>(entrar, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}

      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        placeholder="voce@paivast.com.br"
      />

      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Sua senha"
      />

      <BotaoEntrar />
    </form>
  );
}
