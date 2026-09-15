/**
 * Valores de tema para contextos que NAO conseguem ler CSS.
 *
 * A regra da secao 3.5 da especificacao e que nenhum hexadecimal seja escrito
 * direto em componente: tudo vem de app/globals.css. Existem, porem, alguns
 * lugares onde a cor precisa ser um valor literal em JavaScript, porque e
 * consumida antes de qualquer CSS existir ou fora do navegador:
 *
 *   - <meta name="theme-color">, que pinta a barra do navegador no celular
 *   - futuros templates de e-mail transacional (Fase 2), onde cliente de
 *     e-mail nao suporta custom properties
 *
 * Este arquivo e a unica excecao permitida, e existe justamente para que a
 * excecao fique em um lugar so.
 *
 * AO ALTERAR A PALETA: atualize app/globals.css E este arquivo juntos.
 */
export const CORES_LITERAIS = {
  /** Rosa PaivaPay - espelha --color-marca em app/globals.css */
  marca: "#EF4176",
  /** Grafite - espelha --color-grafite */
  texto: "#141416",
  /** Off-white - espelha --color-fundo */
  fundo: "#FAFAFA",
} as const;
