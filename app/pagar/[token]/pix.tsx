"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BotaoCopiar } from "@/components/ui/copiar";

/**
 * Bloco de pagamento por Pix da pagina publica (secao 8.2).
 *
 * "Pix: exibe QR Code e codigo copia-e-cola, com botao 'copiar'. A tela faz
 *  polling a cada 5 segundos consultando o status; quando confirma, troca para
 *  a tela de sucesso automaticamente."
 *
 * O polling apenas LE o status. Quem confirma pagamento e o webhook, no
 * servidor (secao 10, regra 1) - este componente so reage a confirmacao que ja
 * aconteceu.
 */

const INTERVALO_MS = 5000;

/** Para de consultar depois de 20 minutos de tela aberta. */
const LIMITE_TENTATIVAS = (20 * 60 * 1000) / INTERVALO_MS;

export function PagamentoPix({
  token,
  payload,
  qrCodeDataUrl,
}: {
  token: string;
  payload: string;
  /** QR pronto: vem do PSP ou e gerado no servidor a partir do payload. */
  qrCodeDataUrl: string | null;
}) {
  const router = useRouter();
  const [tentativas, setTentativas] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || tentativas >= LIMITE_TENTATIVAS) return;

    let cancelado = false;

    const temporizador = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/pagar/${token}/status`, {
          cache: "no-store",
        });

        if (!resposta.ok) return;

        const dados = (await resposta.json()) as { status: string };

        if (cancelado) return;

        // O servidor confirmou. router.refresh() recarrega o server component,
        // que passa a renderizar a tela de sucesso.
        if (dados.status === "pago") {
          router.refresh();
          return;
        }

        // Cobranca cancelada ou estornada enquanto a tela estava aberta.
        if (dados.status === "cancelado" || dados.status === "estornado") {
          router.refresh();
          return;
        }
      } catch {
        // Falha de rede: apenas tenta de novo no proximo ciclo.
      } finally {
        if (!cancelado) setTentativas((n) => n + 1);
      }
    }, INTERVALO_MS);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [token, tentativas, pausado, router]);

  // Aba em segundo plano nao precisa consultar: economiza bateria no celular,
  // que e onde a maioria dos pagadores abre esta tela.
  useEffect(() => {
    function aoMudarVisibilidade() {
      setPausado(document.hidden);
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () =>
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  const expirou = tentativas >= LIMITE_TENTATIVAS;

  return (
    <div className="flex flex-col items-center gap-4">
      {qrCodeDataUrl ? (
        <div className="rounded-lg border border-borda bg-superficie p-3">
          <Image
            src={qrCodeDataUrl}
            alt="QR Code para pagamento via Pix"
            width={220}
            height={220}
            className="size-[220px]"
            unoptimized
          />
        </div>
      ) : null}

      <div className="w-full">
        <p className="mb-1.5 text-xs font-medium text-secundario">
          Ou copie o codigo Pix
        </p>

        <p className="mb-2 max-h-20 overflow-y-auto rounded-md border border-borda bg-fundo px-2.5 py-2 font-mono text-[11px] break-all text-secundario">
          {payload}
        </p>

        <BotaoCopiar
          texto={payload}
          rotulo="Copiar codigo Pix"
          rotuloCopiado="Codigo copiado"
          className="w-full justify-center"
        />
      </div>

      <div
        aria-live="polite"
        className="flex items-center gap-2 text-xs text-secundario"
      >
        {expirou ? (
          <>
            <span aria-hidden="true">&#8635;</span>
            <button
              type="button"
              onClick={() => setTentativas(0)}
              className="cursor-pointer underline hover:text-grafite"
            >
              Verificacao pausada. Clique para voltar a verificar.
            </button>
          </>
        ) : (
          <>
            {/* Indicador de atividade: nao depende so de cor. */}
            <span
              aria-hidden="true"
              className="size-1.5 animate-pulse rounded-full bg-aguardando"
            />
            Aguardando confirmacao do pagamento...
          </>
        )}
      </div>
    </div>
  );
}
