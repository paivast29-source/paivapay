import { IconeProibido } from "@/components/ui/icones";
import { Logo } from "@/components/ui/logo";

/**
 * Link de pagamento invalido ou inexistente (secao 8.2).
 *
 * A mesma tela atende "token que nunca existiu" e "token que nao corresponde a
 * nenhuma cobranca pagavel". Distinguir os dois casos permitiria a alguem
 * confirmar quais tokens sao validos.
 */
export default function LinkInvalido() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fundo px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>

        <div className="cartao flex flex-col items-center gap-3 p-8 text-center">
          <IconeProibido className="size-14 text-secundario" />

          <div>
            <h1 className="text-lg font-semibold text-grafite">
              Link invalido
            </h1>
            <p className="mt-1 text-sm text-secundario">
              Este link de pagamento nao existe ou nao esta mais disponivel.
            </p>
          </div>

          <p className="text-xs text-secundario">
            Confira se o endereco foi copiado por inteiro. Se o problema
            continuar, peca um novo link a quem enviou a cobranca.
          </p>
        </div>
      </div>
    </main>
  );
}
