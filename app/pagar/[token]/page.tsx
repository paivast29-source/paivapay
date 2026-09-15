import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Checkout, type DadosCheckout } from "@/app/pagar/[token]/checkout";
import {
  IconeAlerta,
  IconeCheckCirculo,
  IconeProibido,
  IconeRelogio,
} from "@/components/ui/icones";
import { Logo } from "@/components/ui/logo";
import { statusExibicao } from "@/lib/cobrancas/status";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { db } from "@/lib/db";
import { formatarMoeda } from "@/lib/dinheiro";
import type { DadosPagamento } from "@/lib/psp/tipos";

export const metadata: Metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

// Nunca servir status de pagamento a partir de cache.
export const dynamic = "force-dynamic";

/**
 * Pagina publica de pagamento (secao 8.2).
 *
 * Tela unica, otimizada para celular - "a maioria dos clientes vai abrir no
 * celular". O pagador nao tem login: chega pelo link e paga (secao 6.2).
 *
 * Estados obrigatorios, todos tratados abaixo:
 *   cobranca em aberto, ja paga, vencida, cancelada, link invalido.
 */
export default async function PaginaPagamento({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Token fora do formato nem chega ao banco. Os tokens gerados tem 64
  // caracteres (48 bytes em base64url); o minimo exigido pela spec e 32.
  if (!token || token.length < 32 || token.length > 128) notFound();

  const cobranca = await db.cobranca.findUnique({
    where: { tokenPublico: token },
    select: {
      id: true,
      descricao: true,
      valorTotal: true,
      vencimento: true,
      status: true,
      pagoEm: true,
      formasPagamentoAceitas: true,
      dadosPagamento: true,
      itens: {
        select: {
          id: true,
          descricao: true,
          quantidade: true,
          valorTotal: true,
        },
      },
      contaRecebedora: { select: { nome: true } },
    },
  });

  // Link invalido ou inexistente. Mesma resposta para os dois casos: distinguir
  // permitiria confirmar quais tokens existem.
  if (!cobranca) notFound();

  // Rascunho ainda nao foi registrado no PSP - nao ha o que pagar.
  if (cobranca.status === "rascunho") notFound();

  const status = statusExibicao(cobranca);

  // Preparado antes da renderizacao: so a cobranca em aberto mostra checkout,
  // entao nem geramos o QR Code nos demais estados.
  const dadosCheckout =
    status === "aguardando_pagamento"
      ? await montarDadosCheckout(cobranca.dadosPagamento)
      : null;

  // Registra a primeira visualizacao para o historico (tela 8.1). Apenas a
  // primeira: o polling e o router.refresh() reabrem esta pagina varias vezes,
  // e um evento por abertura entupiria o historico.
  if (status === "aguardando_pagamento") {
    const jaVisualizada = await db.eventoCobranca.findFirst({
      where: { cobrancaId: cobranca.id, tipo: "visualizada" },
      select: { id: true },
    });

    if (!jaVisualizada) {
      await db.eventoCobranca
        .create({
          data: {
            cobrancaId: cobranca.id,
            tipo: "visualizada",
            descricao: "Link de pagamento aberto pela primeira vez",
          },
        })
        .catch(() => {
          // Registrar a visualizacao nunca pode impedir o pagamento.
        });
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-fundo">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:py-10">
        <div className="flex justify-center">
          <Logo className="text-2xl" />
        </div>

        <div className="cartao overflow-hidden">
          {/* ---- Cabecalho: quem cobra e quanto -------------------------- */}
          <div className="border-b border-borda px-5 py-5 text-center">
            <p className="text-xs text-secundario">
              Cobranca de{" "}
              <span className="font-medium text-grafite">
                {cobranca.contaRecebedora.nome}
              </span>
            </p>

            <p className="valor-monetario-destaque mt-2 text-4xl text-grafite">
              {formatarMoeda(cobranca.valorTotal)}
            </p>

            <p className="mt-1.5 text-sm text-secundario">
              {cobranca.descricao}
            </p>

            {status === "aguardando_pagamento" ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-aguardando/30 bg-aguardando-fundo px-2.5 py-1 text-xs font-medium text-aguardando">
                <IconeRelogio className="size-3.5" />
                Vence em {formatarData(cobranca.vencimento)}
              </p>
            ) : null}
          </div>

          <div className="px-5 py-5">
            {status === "pago" ? (
              <EstadoPago pagoEm={cobranca.pagoEm} />
            ) : status === "cancelado" ? (
              <EstadoCancelado />
            ) : status === "estornado" ? (
              <EstadoEstornado />
            ) : status === "vencido" ? (
              <EstadoVencido vencimento={cobranca.vencimento} />
            ) : dadosCheckout ? (
              <Checkout
                token={token}
                formasAceitas={cobranca.formasPagamentoAceitas}
                dados={dadosCheckout}
              />
            ) : null}
          </div>

          {/* ---- Itens ---------------------------------------------------- */}
          {cobranca.itens.length > 0 ? (
            <div className="border-t border-borda px-5 py-4">
              <h2 className="mb-2 text-xs font-medium text-secundario">
                Detalhamento
              </h2>

              <ul className="flex flex-col gap-1.5">
                {cobranca.itens.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 text-secundario">
                      {item.quantidade > 1 ? `${item.quantidade}x ` : ""}
                      {item.descricao}
                    </span>
                    <span className="valor-monetario shrink-0 text-grafite">
                      {formatarMoeda(item.valorTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Secao 11: politica de privacidade acessivel a partir da pagina
            de pagamento. */}
        <p className="mt-auto pt-4 text-center text-xs text-secundario">
          Pagamento processado com seguranca.{" "}
          <a href="/privacidade" className="underline hover:text-grafite">
            Politica de privacidade
          </a>
        </p>
      </div>
    </main>
  );
}

/**
 * Prepara os dados do checkout.
 *
 * Quando o PSP nao devolve a imagem do QR pronta - o caso do provider de
 * desenvolvimento - geramos aqui, no servidor, a partir do payload. Gerar no
 * navegador custaria mais uma biblioteca no bundle de uma tela que precisa
 * abrir rapido no celular.
 */
async function montarDadosCheckout(
  dadosPagamento: unknown,
): Promise<DadosCheckout> {
  const dados = (dadosPagamento ?? {}) as DadosPagamento;
  const resultado: DadosCheckout = {};

  if (dados.pix?.payload) {
    let qrCodeDataUrl = dados.pix.qrCodeBase64 ?? null;

    if (!qrCodeDataUrl) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(dados.pix.payload, {
          margin: 1,
          width: 440, // 2x de 220px, para telas de alta densidade
          errorCorrectionLevel: "M",
        });
      } catch (erro) {
        console.error("[pagar] falha ao gerar QR Code", erro);
      }
    }

    resultado.pix = { payload: dados.pix.payload, qrCodeDataUrl };
  }

  if (dados.boleto?.linhaDigitavel) {
    resultado.boleto = {
      linhaDigitavel: dados.boleto.linhaDigitavel,
      urlPdf: dados.boleto.urlPdf,
    };
  }

  if (dados.cartao?.urlCheckout) {
    resultado.cartao = { urlCheckout: dados.cartao.urlCheckout };
  }

  return resultado;
}

/* -------------------------------------------------------------------------- */
/* Estados alternativos                                                        */
/* Todos com icone + texto, nunca so cor (secao 3.2).                          */
/* -------------------------------------------------------------------------- */

function EstadoPago({ pagoEm }: { pagoEm: Date | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <IconeCheckCirculo className="size-14 text-pago" />

      <div>
        <p className="text-lg font-semibold text-pago">Pagamento confirmado</p>
        <p className="mt-0.5 text-sm text-secundario">
          {pagoEm
            ? `Esta cobranca ja foi paga em ${formatarDataHora(pagoEm)}.`
            : "Esta cobranca ja foi paga."}
        </p>
      </div>

      {/*
        O recibo em PDF entra na Fase 2 (secao 12), junto com o e-mail
        transacional. Ate la a confirmacao em tela e o comprovante do proprio
        banco cumprem o papel.
      */}
      <p className="text-xs text-secundario">
        O recibo sera enviado para o seu e-mail.
      </p>
    </div>
  );
}

function EstadoVencido({ vencimento }: { vencimento: Date }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <IconeAlerta className="size-14 text-vencido" />

      <div>
        <p className="text-lg font-semibold text-vencido">Cobranca vencida</p>
        <p className="mt-0.5 text-sm text-secundario">
          O vencimento era {formatarData(vencimento)}.
        </p>
      </div>

      <p className="text-xs text-secundario">
        Entre em contato com quem enviou esta cobranca para receber um novo
        link.
      </p>
    </div>
  );
}

function EstadoCancelado() {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <IconeProibido className="size-14 text-secundario" />

      <div>
        <p className="text-lg font-semibold text-grafite">Cobranca cancelada</p>
        <p className="mt-0.5 text-sm text-secundario">
          Esta cobranca foi cancelada e nao pode mais ser paga.
        </p>
      </div>

      <p className="text-xs text-secundario">
        Se voce acredita que isso e um engano, procure quem enviou o link.
      </p>
    </div>
  );
}

function EstadoEstornado() {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <IconeProibido className="size-14 text-secundario" />

      <div>
        <p className="text-lg font-semibold text-grafite">Pagamento estornado</p>
        <p className="mt-0.5 text-sm text-secundario">
          O valor desta cobranca foi devolvido.
        </p>
      </div>
    </div>
  );
}
