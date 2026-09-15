"use client";

import { useEffect, useState } from "react";
import { IconeCheck, IconeCopiar } from "@/components/ui/icones";

/**
 * Botao de copiar com retorno visual.
 *
 * Usado no link de pagamento (painel) e no codigo Pix copia-e-cola (pagina
 * publica). Nos dois casos o usuario precisa saber que a copia funcionou - sem
 * isso, a duvida leva a clicar varias vezes.
 *
 * A confirmacao vai tambem por aria-live, para nao depender da mudanca de cor.
 */
export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  rotuloCopiado = "Copiado",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  rotuloCopiado?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const tempo = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(tempo);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setFalhou(false);
    } catch {
      // navigator.clipboard exige contexto seguro (HTTPS ou localhost) e
      // permissao. Quando nao da, orientamos a copia manual em vez de falhar
      // em silencio.
      setFalhou(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copiar}
        className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-borda bg-superficie px-3 text-sm font-medium text-grafite transition-colors hover:bg-fundo ${className}`}
      >
        {copiado ? (
          <IconeCheck className="size-4 text-pago" />
        ) : (
          <IconeCopiar className="size-4" />
        )}
        {copiado ? rotuloCopiado : rotulo}
      </button>

      <span aria-live="polite" className="sr-only">
        {copiado ? `${rotuloCopiado}.` : ""}
        {falhou ? "Nao foi possivel copiar. Selecione o texto e copie manualmente." : ""}
      </span>

      {falhou ? (
        <span className="text-xs text-vencido">
          Nao foi possivel copiar automaticamente. Selecione o texto e copie.
        </span>
      ) : null}
    </>
  );
}
