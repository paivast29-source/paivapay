import type { Metadata } from "next";
import { IconeAlerta, IconeCheck } from "@/components/ui/icones";
import { exigirDiretor } from "@/lib/auth/guarda";
import { formatarData } from "@/lib/datas";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Configuracoes" };
export const dynamic = "force-dynamic";

/**
 * Configuracoes (secao 8.1), restrito a diretores (secao 6.1).
 *
 * Nesta entrega a tela e de leitura: mostra a conta recebedora, o estado da
 * integracao com o PSP e os usuarios do painel. A edicao - dados da empresa,
 * logo no recibo, texto padrao dos e-mails, gestao de usuarios - acompanha a
 * Fase 2/3, quando o e-mail transacional entrar.
 *
 * As chaves de API nunca sao exibidas, nem parcialmente: a tela informa apenas
 * se estao configuradas (secao 11).
 */
export default async function PaginaConfiguracoes() {
  await exigirDiretor();

  const [contaRecebedora, usuarios] = await Promise.all([
    db.contaRecebedora.findFirst({ where: { padrao: true } }),
    db.usuario.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        ultimoAcesso: true,
      },
    }),
  ]);

  const provedor = process.env.PSP_PROVIDER || "mock";
  const usandoMock = provedor === "mock";
  const temChaveApi = Boolean(process.env.ASAAS_API_KEY);
  const temTokenWebhook = Boolean(process.env.ASAAS_WEBHOOK_TOKEN);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-grafite">Configuracoes</h1>
        <p className="mt-0.5 text-sm text-secundario">
          Acesso restrito a diretores.
        </p>
      </div>

      {/* ---- Provedor de pagamentos ---------------------------------------- */}
      <section className="cartao p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-grafite">
          Provedor de pagamentos
        </h2>

        {usandoMock ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-aguardando/30 bg-aguardando-fundo px-3 py-2.5 text-sm text-aguardando">
            <IconeAlerta className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Ambiente de desenvolvimento</p>
              <p className="mt-0.5 text-xs">
                As cobrancas sao ficticias e nenhum dinheiro e movimentado. Para
                operar de verdade, configure PSP_PROVIDER=asaas com as chaves do
                Asaas. A aplicacao se recusa a subir em producao com o provider
                de desenvolvimento.
              </p>
            </div>
          </div>
        ) : null}

        <dl className="flex flex-col gap-2.5 text-sm">
          <LinhaConfiguracao rotulo="Provedor" valor={provedor} />
          <LinhaEstado
            rotulo="Chave de API"
            configurado={usandoMock || temChaveApi}
            textoOk={usandoMock ? "Nao se aplica" : "Configurada"}
            textoFalta="Nao configurada"
          />
          <LinhaEstado
            rotulo="Token do webhook"
            configurado={temTokenWebhook || usandoMock}
            textoOk={usandoMock ? "Valor de desenvolvimento" : "Configurado"}
            textoFalta="Nao configurado"
          />
        </dl>

        <p className="mt-3 border-t border-borda pt-3 text-xs text-secundario">
          As chaves ficam apenas em variaveis de ambiente e nunca sao exibidas
          aqui, nem parcialmente.
        </p>
      </section>

      {/* ---- Conta recebedora ---------------------------------------------- */}
      <section className="cartao p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold text-grafite">
          Conta recebedora
        </h2>
        <p className="mb-3 text-xs text-secundario">
          Na v1 todas as cobrancas caem nesta conta. O dinheiro vai do pagador
          direto para ela, sem passar por saldo dentro do PaivaPay.
        </p>

        <dl className="flex flex-col gap-2.5 text-sm">
          <LinhaConfiguracao
            rotulo="Nome"
            valor={contaRecebedora?.nome ?? "Nao configurada"}
          />
          <LinhaConfiguracao
            rotulo="Identificador no PSP"
            valor={contaRecebedora?.idNoPsp ?? "Sera preenchido na integracao"}
          />
        </dl>
      </section>

      {/* ---- Usuarios ------------------------------------------------------ */}
      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 text-sm font-semibold text-grafite sm:px-5">
          Usuarios do painel
        </h2>

        <ul className="divide-y divide-borda">
          {usuarios.map((usuario) => (
            <li
              key={usuario.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-grafite">
                  {usuario.nome}
                </p>
                <p className="truncate text-xs text-secundario">
                  {usuario.email}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full border border-borda bg-fundo px-2 py-0.5 text-secundario capitalize">
                  {usuario.papel}
                </span>

                {usuario.ativo ? (
                  <span className="inline-flex items-center gap-1 text-pago">
                    <IconeCheck className="size-3" />
                    Ativo
                  </span>
                ) : (
                  <span className="text-secundario">Inativo</span>
                )}
              </div>

              <p className="w-full text-xs text-secundario sm:w-auto">
                {usuario.ultimoAcesso
                  ? `Ultimo acesso em ${formatarData(usuario.ultimoAcesso)}`
                  : "Nunca acessou"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LinhaConfiguracao({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-secundario">{rotulo}</dt>
      <dd className="text-right break-all text-grafite">{valor}</dd>
    </div>
  );
}

/** Estado sempre com icone + texto, nunca so cor (secao 3.2). */
function LinhaEstado({
  rotulo,
  configurado,
  textoOk,
  textoFalta,
}: {
  rotulo: string;
  configurado: boolean;
  textoOk: string;
  textoFalta: string;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-secundario">{rotulo}</dt>
      <dd
        className={`inline-flex items-center gap-1.5 text-right ${
          configurado ? "text-pago" : "text-vencido"
        }`}
      >
        {configurado ? (
          <IconeCheck className="size-3.5" />
        ) : (
          <IconeAlerta className="size-3.5" />
        )}
        {configurado ? textoOk : textoFalta}
      </dd>
    </div>
  );
}
