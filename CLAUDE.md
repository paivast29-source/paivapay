@AGENTS.md

# PaivaPay

Plataforma de cobranca da Paiva Studio. Leia o `README.md` para o panorama.
Este arquivo registra o que e facil errar por nao saber.

## Antes de tocar no fluxo de pagamento

A secao 10 da especificacao do produto lista nove regras que "causam prejuizo
financeiro real" quando quebradas. O mapa de onde cada uma vive esta no README.
As tres que mais convidam ao erro:

- **Nunca marque uma cobranca como paga a partir de sinal do frontend.**
  Redirecionamento de navegador, retorno de checkout, resposta de polling: nada
  disso confirma pagamento. Só webhook validado ou consulta direta do servidor
  ao PSP. O endpoint `/api/pagar/[token]/status` existe apenas para LER.

- **Idempotencia de webhook tem dois casos, nao um.** Evento ja processado se
  ignora; evento gravado que falhou no meio do processamento se reprocessa.
  Tratar ambos como duplicado perde pagamentos silenciosamente.

- **Dinheiro e `Int` em centavos, sempre.** Nunca `Float`, nunca `Decimal`.
  Converta na borda com `lib/dinheiro.ts` e mais nada.

## Convencoes deste projeto

- **Codigo e dados em portugues.** Nomes de modelo, campo, funcao, variavel,
  rota e componente seguem o portugues, sem acento em identificadores. Os
  comentarios tambem. Mantenha.

- **Nenhum hexadecimal em componente.** Todas as cores saem de `app/globals.css`.
  Se precisar de uma cor nova, adicione la primeiro.

- **Status nunca so por cor.** O vermelho de erro e o rosa da marca sao
  proximos demais. Use `BadgeStatus`, que obriga icone + texto.

- **Nada de PSP fora de `lib/psp/`.** O resto do codigo so conhece a interface
  `ProvedorPagamento`. Importar o Asaas direto em uma tela quebra a
  possibilidade de rodar com o mock e de trocar de provedor.

- **`conta_recebedora_id` e obrigatorio em toda cobranca.** Parece redundante na
  v1, onde ha uma unica conta. E a unica preparacao estrutural para a v2.

## Ambiente

Prisma 7: a connection string **nao** fica no `schema.prisma`. Migrations leem
de `prisma.config.ts`; o runtime usa o driver adapter em `lib/db.ts`. O CLI nao
carrega `.env` sozinho - por isso o `loadEnvFile` no config e a flag
`--env-file` nos scripts.

Postgres local na porta **5433** (nao 5432), para nao conflitar com instalacao
existente.

## Depois de mexer

```bash
npm run typecheck && npm run lint && npm run build
npm run verificar     # exige npm run dev rodando em outro terminal
```

`npm run verificar` e o teste ponta a ponta das regras criticas. Se ele
quebrar, algo importante quebrou.
