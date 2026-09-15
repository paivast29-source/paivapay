"use client";

import { useState } from "react";
import type { FormaPagamento } from "@prisma/client";
import { PagamentoPix } from "@/app/pagar/[token]/pix";
import { BotaoCopiar } from "@/components/ui/copiar";
import {
  IconeBaixar,
  IconeBoleto,
  IconeCartao,
  IconePix,
} from "@/components/ui/icones";

/**
 * Selecao da forma de pagamento na pagina publica (secao 8.2).
 *
 * "Tres botoes de forma de pagamento: Pix, Cartao, Boleto (mostrar apenas os
 *  habilitados naquela cobranca)."
 *
 * Implementado como tablist: as setas do teclado navegam entre as formas e o
 * leitor de tela anuncia qual esta selecionada. Botoes soltos nao dariam isso.
 */

export type DadosCheckout = {
  pix?: { payload: string; qrCodeDataUrl: string | null };
  boleto?: { linhaDigitavel: string; urlPdf: string };
  cartao?: { urlCheckout: string };
};

const META = {
  pix: { rotulo: "Pix", Icone: IconePix },
  cartao: { rotulo: "Cartao", Icone: IconeCartao },
  boleto: { rotulo: "Boleto", Icone: IconeBoleto },
} as const;

export function Checkout({
  token,
  formasAceitas,
  dados,
}: {
  token: string;
  formasAceitas: FormaPagamento[];
  dados: DadosCheckout;
}) {
  // So oferece a forma que esta habilitada E cujos dados o PSP devolveu.
  const disponiveis = formasAceitas.filter((forma) => Boolean(dados[forma]));
  const [selecionada, setSelecionada] = useState<FormaPagamento | null>(
    disponiveis[0] ?? null,
  );

  if (disponiveis.length === 0) {
    return (
      <p className="rounded-md border border-vencido/30 bg-vencido-fundo px-3 py-2.5 text-sm text-vencido">
        Nenhuma forma de pagamento esta disponivel no momento. Entre em contato
        com quem enviou esta cobranca.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {disponiveis.length > 1 ? (
        <div role="tablist" aria-label="Forma de pagamento" className="flex gap-2">
          {disponiveis.map((forma) => {
            const { rotulo, Icone } = META[forma];
            const ativa = selecionada === forma;

            return (
              <button
                key={forma}
                type="button"
                role="tab"
                id={`aba-${forma}`}
                aria-selected={ativa}
                aria-controls={`painel-${forma}`}
                onClick={() => setSelecionada(forma)}
                className={`flex h-[var(--altura-controle)] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${
                  ativa
                    ? "border-marca bg-marca-clara text-marca"
                    : "border-borda bg-superficie text-secundario hover:text-grafite"
                }`}
              >
                <Icone className="size-4" />
                {rotulo}
              </button>
            );
          })}
        </div>
      ) : null}

      {selecionada === "pix" && dados.pix ? (
        <div role="tabpanel" id="painel-pix" aria-labelledby="aba-pix">
          <PagamentoPix
            token={token}
            payload={dados.pix.payload}
            qrCodeDataUrl={dados.pix.qrCodeDataUrl}
          />
        </div>
      ) : null}

      {selecionada === "cartao" && dados.cartao ? (
        <div
          role="tabpanel"
          id="painel-cartao"
          aria-labelledby="aba-cartao"
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-secundario">
            O pagamento com cartao acontece no ambiente seguro do nosso provedor
            de pagamentos. Voce sera redirecionado.
          </p>

          <a
            href={dados.cartao.urlCheckout}
            className="inline-flex h-[var(--altura-controle)] w-full items-center justify-center gap-2 rounded-md bg-marca text-sm font-medium text-superficie shadow-marca transition-colors hover:bg-marca-hover"
          >
            <IconeCartao className="size-4" />
            Pagar com cartao
          </a>

          {/*
            Secao 2.2 e secao 10, regra 7: nenhum dado de cartao trafega ou e
            armazenado pelo PaivaPay. Dizer isso ao pagador reduz o abandono.
          */}
          <p className="text-center text-xs text-secundario">
            Os dados do seu cartao nao passam pelo PaivaPay.
          </p>
        </div>
      ) : null}

      {selecionada === "boleto" && dados.boleto ? (
        <div
          role="tabpanel"
          id="painel-boleto"
          aria-labelledby="aba-boleto"
          className="flex flex-col gap-3"
        >
          <div>
            <p className="mb-1.5 text-xs font-medium text-secundario">
              Linha digitavel
            </p>
            <p className="mb-2 rounded-md border border-borda bg-fundo px-2.5 py-2 font-mono text-xs break-all text-grafite">
              {dados.boleto.linhaDigitavel}
            </p>
            <BotaoCopiar
              texto={dados.boleto.linhaDigitavel.replace(/[^\d]/g, "")}
              rotulo="Copiar linha digitavel"
              rotuloCopiado="Linha copiada"
              className="w-full justify-center"
            />
          </div>

          {dados.boleto.urlPdf ? (
            <a
              href={dados.boleto.urlPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[var(--altura-controle)] w-full items-center justify-center gap-2 rounded-md border border-borda bg-superficie text-sm font-medium text-grafite transition-colors hover:bg-fundo"
            >
              <IconeBaixar className="size-4" />
              Baixar boleto em PDF
            </a>
          ) : null}

          <p className="text-center text-xs text-secundario">
            A confirmacao do boleto pode levar ate 3 dias uteis.
          </p>
        </div>
      ) : null}
    </div>
  );
}
