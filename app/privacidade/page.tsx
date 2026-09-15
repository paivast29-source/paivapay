import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Politica de privacidade" };

/**
 * Politica de privacidade (secao 11 da especificacao).
 *
 * "Politica de privacidade acessivel a partir da pagina de pagamento."
 *
 * ATENCAO PARA A PAIVA STUDIO: este e um texto-base tecnico, que descreve com
 * precisao o que o sistema de fato coleta e faz. Ele NAO e peca juridica e
 * precisa ser revisado por advogado antes de entrar no ar - como o proprio
 * documento de especificacao registra na nota final. Os campos entre colchetes
 * precisam ser preenchidos.
 */
export default function PaginaPrivacidade() {
  return (
    <main className="min-h-dvh bg-fundo px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo className="text-2xl" />
        </div>

        <article className="cartao flex flex-col gap-5 p-6 sm:p-8">
          <header>
            <h1 className="text-xl font-semibold text-grafite">
              Politica de privacidade
            </h1>
            <p className="mt-1 text-sm text-secundario">
              Como a Paiva Studio trata os seus dados no PaivaPay.
            </p>
          </header>

          <Secao titulo="Quem e o controlador dos dados">
            <p>
              Paiva Studio, inscrita no CNPJ [PREENCHER], responsavel pelo
              tratamento dos dados descritos abaixo. Contato:{" "}
              <a
                href="mailto:contato@paivast.com.br"
                className="text-marca hover:underline"
              >
                contato@paivast.com.br
              </a>
              .
            </p>
          </Secao>

          <Secao titulo="Quais dados coletamos">
            <p>
              Coletamos apenas o necessario para emitir e liquidar a cobranca:
              nome ou razao social, CPF ou CNPJ, e-mail, telefone e, quando
              informado, endereco. Registramos tambem a data e o endereco IP de
              acesso ao link de pagamento, para fins de seguranca e auditoria.
            </p>
          </Secao>

          <Secao titulo="Dados de cartao">
            <p>
              O PaivaPay <strong>nao recebe, nao processa e nao armazena</strong>{" "}
              numero de cartao, codigo de seguranca ou data de validade. O
              pagamento com cartao acontece inteiramente no ambiente do nosso
              provedor de pagamentos, que e instituicao autorizada pelo Banco
              Central.
            </p>
          </Secao>

          <Secao titulo="Com quem compartilhamos">
            <p>
              Compartilhamos os dados estritamente necessarios com o provedor de
              pagamentos responsavel por processar a transacao, e com autoridades
              publicas quando houver obrigacao legal. Nao vendemos dados e nao os
              usamos para publicidade.
            </p>
          </Secao>

          <Secao titulo="Por quanto tempo guardamos">
            <p>
              Mantemos os registros financeiros pelo prazo exigido pela legislacao
              fiscal brasileira, de [PREENCHER] anos. Registros de auditoria sao
              preservados pelo mesmo periodo e nao sao alterados apos a criacao.
            </p>
          </Secao>

          <Secao titulo="Comunicacoes por e-mail">
            <p>
              Enviamos por e-mail a cobranca, lembretes de vencimento e o recibo
              de pagamento. Esse envio decorre da relacao de cobranca e o
              consentimento fica registrado no cadastro, com data. Para deixar de
              receber, responda a qualquer mensagem ou escreva para o contato
              acima.
            </p>
          </Secao>

          <Secao titulo="Seus direitos">
            <p>
              A LGPD garante a voce o direito de confirmar a existencia de
              tratamento, acessar seus dados, corrigir dados incompletos ou
              desatualizados, solicitar anonimizacao ou eliminacao de dados
              desnecessarios, e revogar consentimento. Para exercer qualquer
              deles, escreva para o contato acima.
            </p>
          </Secao>

          <footer className="border-t border-borda pt-4 text-xs text-secundario">
            <p>Ultima atualizacao: [PREENCHER].</p>
          </footer>
        </article>
      </div>
    </main>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold text-grafite">{titulo}</h2>
      <div className="text-sm leading-relaxed text-secundario">{children}</div>
    </section>
  );
}
