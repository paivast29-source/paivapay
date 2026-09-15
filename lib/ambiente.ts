/**
 * Leitura de ambiente, sem dependencia nenhuma.
 *
 * Fica separado de lib/psp/ de proposito: o layout raiz precisa saber se deve
 * exibir o aviso de demonstracao, e importar lib/psp so para isso arrastaria os
 * providers e o cliente do banco para dentro de toda pagina.
 */

/**
 * Vitrine de demonstracao: ambiente publicado, com dominio publico, rodando de
 * proposito com cobrancas ficticias.
 *
 * Serve para mostrar o produto funcionando antes de a conta no PSP existir
 * (Fase 0 da especificacao). Precisa ser declarada a mao - nenhum esquecimento
 * de configuracao produz o valor "sim".
 */
export function ehVitrineDemonstracao(): boolean {
  return process.env.PERMITIR_PSP_MOCK?.toLowerCase() === "sim";
}

/**
 * true quando a interface precisa avisar o visitante de que nada ali e real.
 *
 * Em desenvolvimento local nao mostramos o aviso: quem roda `npm run dev` sabe
 * onde esta. O aviso existe para o ambiente publicado, onde um visitante
 * poderia confundir a demonstracao com o produto em operacao.
 */
export function deveAvisarQueEhDemonstracao(): boolean {
  return process.env.NODE_ENV === "production" && ehVitrineDemonstracao();
}
