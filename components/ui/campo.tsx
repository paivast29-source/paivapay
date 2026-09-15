"use client";

import { useId } from "react";

/**
 * Campos de formulario.
 *
 * Client component por causa do useId, que gera os ids que ligam rotulo,
 * dica e mensagem de erro ao controle.
 *
 * O rotulo e sempre associado ao controle por id/htmlFor - nao por
 * posicionamento visual - para que leitores de tela anunciem o campo
 * corretamente. A mensagem de erro e ligada por aria-describedby e marcada com
 * role="alert", de modo que a validacao seja anunciada, e nao apenas colorida
 * de vermelho (mesmo raciocinio da secao 3.2).
 */

const CLASSES_CONTROLE =
  "w-full rounded-md border border-borda bg-superficie px-3 text-sm text-grafite " +
  "placeholder:text-secundario/60 transition-colors " +
  "hover:border-secundario/40 disabled:bg-fundo disabled:text-secundario";

type PropsBase = {
  rotulo: string;
  erro?: string | null;
  dica?: string;
  /**
   * Esconde o rotulo visualmente, mantendo-o no DOM para leitores de tela.
   *
   * Usado em linhas repetidas - como os itens da cobranca - onde o cabecalho da
   * coluna ja diz o que e o campo, mas cada controle ainda precisa do proprio
   * rotulo acessivel. Nunca remova o rotulo em vez de ocultar: um input sem
   * label e anunciado apenas como "caixa de edicao".
   */
  rotuloOculto?: boolean;
};

const CLASSES_ROTULO = "text-sm font-medium text-grafite";

export function Campo({
  rotulo,
  erro,
  dica,
  rotuloOculto,
  className,
  id,
  ...props
}: PropsBase & React.InputHTMLAttributes<HTMLInputElement>) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idErro = `${idCampo}-erro`;
  const idDica = `${idCampo}-dica`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={idCampo}
        className={rotuloOculto ? "sr-only" : CLASSES_ROTULO}
      >
        {rotulo}
      </label>

      <input
        {...props}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={
          [erro ? idErro : null, dica ? idDica : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={[
          CLASSES_CONTROLE,
          "h-[var(--altura-controle)]",
          erro ? "border-vencido" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {dica && !erro ? (
        <p id={idDica} className="text-xs text-secundario">
          {dica}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} role="alert" className="text-xs font-medium text-vencido">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export function CampoSelecao({
  rotulo,
  erro,
  dica,
  className,
  id,
  children,
  ...props
}: PropsBase & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idErro = `${idCampo}-erro`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium text-grafite">
        {rotulo}
      </label>

      <select
        {...props}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={[
          CLASSES_CONTROLE,
          "h-[var(--altura-controle)]",
          erro ? "border-vencido" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </select>

      {dica && !erro ? (
        <p className="text-xs text-secundario">{dica}</p>
      ) : null}

      {erro ? (
        <p id={idErro} role="alert" className="text-xs font-medium text-vencido">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** Caixa de mensagem de erro de formulario inteiro. */
export function AvisoErro({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-vencido/30 bg-vencido-fundo px-3 py-2.5 text-sm text-vencido"
    >
      <span aria-hidden="true" className="font-bold leading-5">
        !
      </span>
      <span>{children}</span>
    </div>
  );
}
