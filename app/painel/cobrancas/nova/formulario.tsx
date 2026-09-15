"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  criarCobranca,
  type EstadoCobranca,
} from "@/app/painel/cobrancas/acoes";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { AvisoErro, Campo, CampoSelecao } from "@/components/ui/campo";
import {
  IconeBoleto,
  IconeCartao,
  IconeLixeira,
  IconeMais,
  IconePix,
} from "@/components/ui/icones";
import { formatarMoeda, paraCentavos } from "@/lib/dinheiro";

type ClienteOpcao = { id: string; nome: string };

type LinhaItem = {
  /** Chave estavel de render; nao vai para o servidor. */
  chave: number;
  descricao: string;
  quantidade: string;
  valor: string;
};

const FORMAS = [
  { valor: "pix", rotulo: "Pix", Icone: IconePix },
  { valor: "cartao", rotulo: "Cartao", Icone: IconeCartao },
  { valor: "boleto", rotulo: "Boleto", Icone: IconeBoleto },
] as const;

function linhaVazia(chave: number): LinhaItem {
  return { chave, descricao: "", quantidade: "1", valor: "" };
}

function BotaoCriar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "Criando cobranca..." : "Criar e enviar cobranca"}
    </Botao>
  );
}

export function FormularioCobranca({
  clientes,
  clienteInicial,
  vencimentoPadrao,
}: {
  clientes: ClienteOpcao[];
  clienteInicial?: string;
  /** YYYY-MM-DD */
  vencimentoPadrao: string;
}) {
  const [estado, acao] = useActionState<EstadoCobranca, FormData>(
    criarCobranca,
    {},
  );

  const [itens, setItens] = useState<LinhaItem[]>([linhaVazia(0)]);
  const [proximaChave, setProximaChave] = useState(1);

  function atualizarItem(
    chave: number,
    campo: keyof Omit<LinhaItem, "chave">,
    valor: string,
  ) {
    setItens((atual) =>
      atual.map((item) =>
        item.chave === chave ? { ...item, [campo]: valor } : item,
      ),
    );
  }

  function adicionarItem() {
    setItens((atual) => [...atual, linhaVazia(proximaChave)]);
    setProximaChave((n) => n + 1);
  }

  function removerItem(chave: number) {
    setItens((atual) =>
      atual.length === 1 ? atual : atual.filter((item) => item.chave !== chave),
    );
  }

  // Total mostrado ao usuario enquanto ele digita. E apenas uma previa: quem
  // calcula o valor que vale e o servidor, a partir dos mesmos itens.
  const totalPrevisto = useMemo(
    () =>
      itens.reduce((soma, item) => {
        const unitario = paraCentavos(item.valor);
        const quantidade = Number.parseInt(item.quantidade, 10);
        if (unitario === null || !Number.isFinite(quantidade)) return soma;
        return soma + unitario * Math.max(quantidade, 0);
      }, 0),
    [itens],
  );

  return (
    <form action={acao} className="flex flex-col gap-5">
      {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}

      <div className="cartao flex flex-col gap-4 p-4 sm:p-5">
        <CampoSelecao
          rotulo="Cliente"
          name="clienteId"
          required
          defaultValue={clienteInicial ?? ""}
          erro={estado.errosPorCampo?.clienteId}
        >
          <option value="" disabled>
            Selecione um cliente
          </option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </CampoSelecao>

        <Campo
          rotulo="Descricao da cobranca"
          name="descricao"
          required
          placeholder="Ex.: Identidade visual - parcela 1 de 3"
          erro={estado.errosPorCampo?.descricao}
          dica="Aparece no e-mail e na pagina de pagamento do cliente."
        />
      </div>

      {/* ---- Itens ---------------------------------------------------------- */}
      <div className="cartao flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-grafite">Itens</h2>
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            onClick={adicionarItem}
          >
            <IconeMais className="size-3.5" />
            Adicionar item
          </Botao>
        </div>

        {estado.errosPorCampo?.itens ? (
          <AvisoErro>{estado.errosPorCampo.itens}</AvisoErro>
        ) : null}

        <div className="flex flex-col gap-3">
          {itens.map((item, indice) => (
            <div
              key={item.chave}
              className="grid grid-cols-1 gap-2 border-b border-borda pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end"
            >
              <Campo
                rotulo={
                  indice === 0 ? "Descricao" : `Descricao do item ${indice + 1}`
                }
                rotuloOculto={indice > 0}
                name="item-descricao"
                value={item.descricao}
                onChange={(evento) =>
                  atualizarItem(item.chave, "descricao", evento.target.value)
                }
                placeholder="Ex.: Criacao de logotipo"
              />

              <Campo
                rotulo={
                  indice === 0 ? "Qtd." : `Quantidade do item ${indice + 1}`
                }
                rotuloOculto={indice > 0}
                name="item-quantidade"
                type="number"
                min={1}
                step={1}
                value={item.quantidade}
                onChange={(evento) =>
                  atualizarItem(item.chave, "quantidade", evento.target.value)
                }
              />

              <Campo
                rotulo={
                  indice === 0
                    ? "Valor unitario"
                    : `Valor unitario do item ${indice + 1}`
                }
                rotuloOculto={indice > 0}
                name="item-valor"
                inputMode="decimal"
                value={item.valor}
                onChange={(evento) =>
                  atualizarItem(item.chave, "valor", evento.target.value)
                }
                placeholder="0,00"
              />

              <button
                type="button"
                onClick={() => removerItem(item.chave)}
                disabled={itens.length === 1}
                aria-label={`Remover item ${indice + 1}`}
                className="flex h-[var(--altura-controle)] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-borda text-secundario transition-colors hover:border-vencido/30 hover:bg-vencido-fundo hover:text-vencido disabled:pointer-events-none disabled:opacity-40 sm:w-11"
              >
                <IconeLixeira className="size-4" />
                <span className="sm:hidden">Remover item</span>
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between border-t border-borda pt-3">
          <span className="text-sm font-medium text-grafite">Total</span>
          <span className="valor-monetario-destaque text-lg text-grafite">
            {formatarMoeda(totalPrevisto)}
          </span>
        </div>
      </div>

      {/* ---- Vencimento e formas de pagamento -------------------------------- */}
      <div className="cartao flex flex-col gap-4 p-4 sm:p-5">
        <div className="max-w-xs">
          <Campo
            rotulo="Vencimento"
            name="vencimento"
            type="date"
            required
            defaultValue={vencimentoPadrao}
            erro={estado.errosPorCampo?.vencimento}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-grafite">
            Formas de pagamento aceitas
          </legend>

          {estado.errosPorCampo?.formasPagamento ? (
            <div className="mb-2">
              <AvisoErro>{estado.errosPorCampo.formasPagamento}</AvisoErro>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {FORMAS.map(({ valor, rotulo, Icone }) => (
              <label
                key={valor}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-grafite transition-colors hover:bg-fundo has-checked:border-marca has-checked:bg-marca-clara has-checked:text-marca"
              >
                <input
                  type="checkbox"
                  name="formasPagamento"
                  value={valor}
                  defaultChecked={valor === "pix"}
                  className="size-4 accent-[var(--cor-marca)]"
                />
                <Icone className="size-4" />
                {rotulo}
              </label>
            ))}
          </div>

          <p className="mt-2 text-xs text-secundario">
            Apenas as formas marcadas aparecem na pagina de pagamento do cliente.
          </p>
        </fieldset>
      </div>

      <div className="flex flex-wrap gap-2">
        <BotaoCriar />
        <BotaoLink href="/painel/cobrancas" variante="secundario">
          Cancelar
        </BotaoLink>
      </div>
    </form>
  );
}
