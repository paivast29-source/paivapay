import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AvisoDemonstracao } from "@/components/ui/aviso-demonstracao";
import { CORES_LITERAIS } from "@/lib/tema";
import "./globals.css";

/**
 * Secao 3.3 da especificacao: fonte unica Inter, pesos 400, 500, 600 e 700.
 * A variavel --fonte-inter e consumida por --font-sans no bloco @theme de
 * globals.css.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PaivaPay",
    template: "%s - PaivaPay",
  },
  description: "Plataforma de cobranca e pagamento da Paiva Studio.",
  // A pagina publica de pagamento nao deve ser indexada: cada link e privado
  // e destinado a um unico pagador.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Pinta a barra do navegador no celular. E metadata HTML, entregue antes de
  // qualquer CSS carregar, entao nao pode usar var(--cor-marca) - por isso vem
  // de lib/tema.ts, a unica excecao a regra de "nenhum hex fora do tema".
  themeColor: CORES_LITERAIS.marca,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">
        {/*
          Fica no layout raiz para cobrir tudo de uma vez: painel, login e
          principalmente a pagina publica de pagamento, onde um visitante nao
          pode confundir a demonstracao com uma cobranca real.
          Nao renderiza nada fora do ambiente de vitrine.
        */}
        <AvisoDemonstracao />
        {children}
      </body>
    </html>
  );
}
