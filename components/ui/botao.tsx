import Link from "next/link";

/**
 * Botao da aplicacao.
 *
 * A altura vem de --altura-controle (44px), definida no arquivo de tema e
 * compartilhada com o Paiva Work (secao 3.5). 44px tambem e o alvo minimo de
 * toque recomendado para celular, que e onde a maioria dos pagadores abre a
 * pagina de pagamento.
 *
 * Nenhum hex aqui: todas as cores saem das utilitarias geradas pelo bloco
 * @theme de globals.css.
 */

type Variante = "primario" | "secundario" | "fantasma" | "perigo";
type Tamanho = "normal" | "pequeno";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-marca text-superficie hover:bg-marca-hover active:bg-marca-hover shadow-marca",
  secundario:
    "bg-superficie text-grafite border border-borda hover:bg-fundo active:bg-fundo",
  fantasma: "bg-transparent text-secundario hover:bg-fundo hover:text-grafite",
  // Usado em acoes destrutivas. Nunca aparece sozinho: sempre acompanhado de
  // texto explicito, pelo mesmo motivo da secao 3.2.
  perigo:
    "bg-superficie text-vencido border border-vencido/30 hover:bg-vencido-fundo",
};

const TAMANHOS: Record<Tamanho, string> = {
  normal: "h-[var(--altura-controle)] px-4 text-sm",
  pequeno: "h-9 px-3 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

function classes(
  variante: Variante,
  tamanho: Tamanho,
  larguraTotal: boolean,
  extra?: string,
) {
  return [
    BASE,
    VARIANTES[variante],
    TAMANHOS[tamanho],
    larguraTotal ? "w-full" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

type PropsBotao = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamanho?: Tamanho;
  larguraTotal?: boolean;
};

export function Botao({
  variante = "primario",
  tamanho = "normal",
  larguraTotal = false,
  className,
  ...props
}: PropsBotao) {
  return (
    <button
      {...props}
      className={classes(variante, tamanho, larguraTotal, className)}
    />
  );
}

type PropsBotaoLink = React.ComponentProps<typeof Link> & {
  variante?: Variante;
  tamanho?: Tamanho;
  larguraTotal?: boolean;
};

/** Mesma aparencia do botao, mas navega. Usa <Link> para nao recarregar a pagina. */
export function BotaoLink({
  variante = "primario",
  tamanho = "normal",
  larguraTotal = false,
  className,
  ...props
}: PropsBotaoLink) {
  return (
    <Link
      {...props}
      className={classes(variante, tamanho, larguraTotal, className)}
    />
  );
}
