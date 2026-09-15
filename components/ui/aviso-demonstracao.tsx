import { IconeAlerta } from "@/components/ui/icones";
import { deveAvisarQueEhDemonstracao } from "@/lib/ambiente";

/**
 * Faixa de aviso da vitrine de demonstracao.
 *
 * Aparece somente quando o ambiente esta publicado E rodando com o provider
 * ficticio (PERMITIR_PSP_MOCK="sim"). Em desenvolvimento local nao aparece:
 * quem roda `npm run dev` sabe onde esta.
 *
 * O aviso e obrigatorio nesse cenario. Sem ele, alguem poderia abrir um link de
 * pagamento da vitrine, escanear o QR Code e acreditar que pagou algo. O texto
 * e direto por isso - "nenhuma cobranca aqui e real" - e nao um rodape discreto.
 *
 * Como todo estado neste projeto, combina icone + texto, nunca so cor
 * (secao 3.2 da especificacao).
 */
export function AvisoDemonstracao() {
  if (!deveAvisarQueEhDemonstracao()) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-aguardando px-4 py-2 text-center text-xs font-medium text-grafite"
    >
      <IconeAlerta className="size-4 shrink-0" />
      <span>
        Ambiente de demonstracao. Nenhuma cobranca aqui e real e nenhum pagamento
        e processado.
      </span>
    </div>
  );
}
