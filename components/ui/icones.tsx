/**
 * Icones em SVG inline.
 *
 * Nao usamos biblioteca de icones de proposito: sao poucos icones, e a
 * pagina publica de pagamento abre majoritariamente no celular (secao 8.2).
 * Cada quilobyte de JavaScript a menos nessa tela e conversao a mais.
 *
 * Todos herdam a cor do texto via `currentColor` - nenhum hex aqui, conforme
 * a regra da secao 3.5.
 */

type PropsIcone = {
  className?: string;
  /** Rotulo para leitor de tela. Sem ele o icone e tratado como decorativo. */
  titulo?: string;
};

function Svg({
  children,
  className = "size-4",
  titulo,
}: PropsIcone & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      {titulo ? <title>{titulo}</title> : null}
      {children}
    </svg>
  );
}

export function IconeCheck(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconeCheckCirculo(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function IconeRelogio(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  );
}

export function IconeAlerta(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M12 9v4" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconeProibido(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Svg>
  );
}

export function IconeRascunho(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
    </Svg>
  );
}

export function IconeVoltar(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </Svg>
  );
}

export function IconeCopiar(props: PropsIcone) {
  return (
    <Svg {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
    </Svg>
  );
}

export function IconePix(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M12 2.7 21.3 12 12 21.3 2.7 12z" />
      <path d="M7.5 7.5 12 12l4.5-4.5" />
    </Svg>
  );
}

export function IconeCartao(props: PropsIcone) {
  return (
    <Svg {...props}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </Svg>
  );
}

export function IconeBoleto(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M3 5v14" />
      <path d="M7 5v14" />
      <path d="M11 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </Svg>
  );
}

export function IconePainel(props: PropsIcone) {
  return (
    <Svg {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </Svg>
  );
}

export function IconeCobrancas(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2Z" />
      <path d="M8 8h8" />
      <path d="M8 12h5" />
    </Svg>
  );
}

export function IconeClientes(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </Svg>
  );
}

export function IconeRelatorios(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-4 3 3 5-6" />
    </Svg>
  );
}

export function IconeConfiguracoes(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  );
}

export function IconeSair(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  );
}

export function IconeMais(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconeBusca(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconeLixeira(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </Svg>
  );
}

export function IconeSeta(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Svg>
  );
}

export function IconeBaixar(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </Svg>
  );
}
