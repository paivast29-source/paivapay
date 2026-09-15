/**
 * Logo do PaivaPay.
 *
 * Secao 3.4 da especificacao: a logo e responsabilidade da Paiva Studio, nao do
 * desenvolvedor, e sera entregue em SVG nas versoes colorida, monocromatica
 * branca e monocromatica preta.
 *
 * Ate a entrega desses arquivos, este componente implementa a direcao ja
 * definida no documento - wordmark "PaivaPay" em peso 700, "Paiva" em grafite e
 * "Pay" em rosa; monograma "P" em branco sobre quadrado rosa arredondado para
 * favicon e avatar.
 *
 * PARA SUBSTITUIR PELA LOGO OFICIAL: troque o conteudo destes dois componentes
 * pelo <svg> entregue (ou por <Image>). A API publica - as props - deve
 * continuar a mesma, e nenhuma outra tela precisara mudar.
 */

type PropsLogo = {
  className?: string;
  /** Versao monocromatica para fundos escuros ou impressao. */
  variante?: "colorida" | "branca" | "preta";
};

export function Logo({ className = "", variante = "colorida" }: PropsLogo) {
  const corPaiva =
    variante === "branca"
      ? "text-superficie"
      : variante === "preta"
        ? "text-grafite"
        : "text-grafite";

  const corPay =
    variante === "branca"
      ? "text-superficie"
      : variante === "preta"
        ? "text-grafite"
        : "text-marca";

  return (
    <span
      className={`font-bold tracking-tight select-none ${className}`}
      // O leitor de tela deve anunciar "PaivaPay", e nao as duas partes soltas.
      aria-label="PaivaPay"
      role="img"
    >
      <span className={corPaiva} aria-hidden="true">
        Paiva
      </span>
      <span className={corPay} aria-hidden="true">
        Pay
      </span>
    </span>
  );
}

/** Monograma quadrado, para favicon, avatar e cabecalho compacto. */
export function LogoMarca({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-marca font-bold text-superficie select-none ${className}`}
      aria-label="PaivaPay"
      role="img"
    >
      <span aria-hidden="true">P</span>
    </span>
  );
}
