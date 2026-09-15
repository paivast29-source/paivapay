# PaivaPay

Plataforma de cobranca e pagamento da Paiva Studio.

Marca e interface propria; a movimentacao financeira acontece inteiramente
dentro de um provedor de pagamentos (PSP) licenciado pelo Banco Central. O
PaivaPay e a camada de interface, gestao e identidade visual sobre esse
provedor.

Esta entrega cobre a **Fase 1** da especificacao: autenticacao, clientes,
cobranca avulsa, link publico, Pix, webhook e dashboard.

---

## Comecando

Requisitos: Node 20+ e Docker Desktop.

```bash
cp .env.example .env     # e gere um SESSION_SECRET novo (instrucao dentro do arquivo)
npm install
npm run db:up            # sobe o Postgres em localhost:5433
npx prisma migrate deploy
npm run db:seed          # cria a conta recebedora padrao e o usuario diretor
npm run dev
```

Acesse http://localhost:3000 e entre com as credenciais que o seed imprimiu no
terminal.

> O `.env.example` traz `SEED_ADMIN_SENHA="mudar123"`. Troque antes de qualquer
> uso que nao seja local.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run typecheck` | Checagem de tipos |
| `npm run lint` | ESLint |
| `npm run verificar` | **Teste ponta a ponta das regras criticas** (exige `npm run dev` rodando) |
| `npm run db:up` / `db:down` | Sobe / derruba o Postgres |
| `npm run db:migrate` | Cria e aplica migration |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Recria o banco do zero |

---

## Como testar o fluxo completo sem conta no PSP

O projeto roda com `PSP_PROVIDER=mock`, um provedor local que gera Pix e boleto
ficticios sem nenhuma chamada de rede.

1. Cadastre um cliente em **Clientes > Novo cliente**
2. Crie uma cobranca em **Cobrancas > Nova cobranca**
3. Na tela da cobranca, copie o link e abra em outra aba: e a pagina que o
   cliente ve, com QR Code e codigo copia-e-cola
4. Volte ao painel e clique em **Simular pagamento**

O botao de simulacao nao escreve no banco: ele monta um payload no formato do
PSP e faz uma requisicao HTTP real ao nosso proprio endpoint de webhook. O
caminho exercitado e exatamente o que vai rodar em producao - validacao de
assinatura, gravacao idempotente, atualizacao de status e auditoria.

A pagina publica detecta a confirmacao pelo polling de 5 segundos e troca
sozinha para a tela de sucesso.

`npm run verificar` automatiza tudo isso e confere 26 asseveracoes sobre as
regras criticas.

---

## Arquitetura

```
app/
  entrar/                  login (rate limiting, argon2, cookie httpOnly)
  painel/                  area autenticada
    cobrancas/             lista, nova, detalhe
    clientes/              lista, novo, ficha
    relatorios/            recebimentos + CSV        [diretor]
    configuracoes/         estado da integracao      [diretor]
  pagar/[token]/           pagina publica de pagamento (sem login)
  privacidade/             politica de privacidade
  api/
    webhooks/asaas/        recepcao de webhook do PSP
    pagar/[token]/status/  polling da pagina publica (somente leitura)
    relatorios/csv/        exportacao
    rotinas/reconciliacao/ rotina diaria (cron)

lib/
  auth/                    senha, sessao, rate limit, guardas de papel
  cobrancas/               regras de negocio e status
  psp/                     adaptador de provedor: tipos, mock, asaas
  db.ts  dinheiro.ts  documento.ts  datas.ts  token.ts  auditoria.ts

components/
  ui/                      botao, campo, badge de status, logo, icones
  painel/                  navegacao, cartao de destaque, grafico
```

### Duas decisoes que valem entender antes de mexer

**1. O adaptador de PSP (`lib/psp/`).** Nenhuma tela, rota ou regra de negocio
importa o Asaas diretamente - todas falam com a interface `ProvedorPagamento`.
Trocar de provedor custa escrever um arquivo novo que implemente essa interface.
E o que permite o provider mock existir sem contaminar o codigo de producao.

**2. `conta_recebedora_id` em toda cobranca.** Na v1 aponta sempre para a mesma
conta, a da Paiva Studio. Esse unico campo, decidido agora, transforma a v2
("permitir que outras empresas recebam pelos seus proprios clientes") de
"reescrever o sistema" em "adicionar um modulo". Nao remova nem torne opcional.

---

## As regras que nao podem ser quebradas

Estao na secao 10 da especificacao e valem releitura antes de qualquer
alteracao no fluxo de pagamento. Onde cada uma vive no codigo:

| Regra | Onde |
|---|---|
| 1. Confirmacao so vem do backend | `app/api/webhooks/asaas/route.ts`, `lib/cobrancas/servico.ts` |
| 2. Todo webhook e validado | `validarAssinaturaWebhook` em cada provider |
| 3. Webhooks sao idempotentes | unicidade de `id_evento_psp` + guarda em `aplicarStatusDoPsp` |
| 4. Reconciliacao diaria | `app/api/rotinas/reconciliacao/route.ts` |
| 5. Token publico aleatorio | `lib/token.ts` (48 bytes, `crypto.randomBytes`) |
| 6. Valores em centavos, inteiro | `lib/dinheiro.ts`, tipo `Int` em todo o schema |
| 7. Nenhum dado de cartao | checkout hospedado do PSP + `sanitizarPayload` |
| 8. Auditoria imutavel | `lib/auditoria.ts` - so expoe `registrar`, nao ha update nem delete |
| 9. Cobranca paga e imutavel | `podeEditar` / `podeCancelar` em `lib/cobrancas/status.ts` |

O ponto mais sutil e a **idempotencia**. Um webhook reenviado que ja foi
processado e ignorado; um que foi gravado mas falhou no meio do processamento e
reprocessado. Tratar os dois como "duplicado" deixaria um pagamento confirmado
sem nunca aparecer no painel. O caminho esta comentado na rota.

---

## Identidade visual

Todas as cores vivem em `app/globals.css`, em um unico bloco. **Nenhum
hexadecimal deve ser escrito em componente** - eles consomem as utilitarias do
Tailwind (`bg-marca`, `text-secundario`) ou `var(--cor-*)`. Trocar a paleta
inteira para outro produto da familia Paiva custa editar esse arquivo.

O vermelho de erro (`#DC2626`) e o rosa da marca (`#EF4176`) sao proximos, entao
**nenhum status e comunicado so por cor**. O componente `BadgeStatus` nao expoe
prop que permita esconder o icone ou o texto - a regra e estrutural, nao uma
lembranca.

A logo em `components/ui/logo.tsx` implementa a direcao definida na spec
(wordmark, "Paiva" grafite + "Pay" rosa). Quando os SVGs oficiais chegarem,
substitua o conteudo dos dois componentes mantendo as props: nenhuma outra tela
precisa mudar.

---

## Publicando na Vercel

O build **nao exige variavel nenhuma** - `prisma generate` nao acessa banco e
nenhum modulo abre conexao durante a compilacao. Mas o site so funciona com um
Postgres acessivel pela internet: o container do `docker-compose.yml` roda em
`localhost` e a Vercel nao alcanca a sua maquina.

### Variaveis de ambiente

| Variavel | Obrigatoria | Valor |
|---|---|---|
| `DATABASE_URL` | sim | Postgres na nuvem (Neon ou Supabase, ambos tem plano gratuito) |
| `SESSION_SECRET` | sim | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `APP_URL` | sim | a URL publicada, ex. `https://paivapay.vercel.app` |
| `PSP_PROVIDER` | sim | `asaas` em operacao real, `mock` na vitrine |
| `CRON_SECRET` | sim | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ASAAS_API_KEY` | so com `asaas` | chave da conta |
| `ASAAS_WEBHOOK_TOKEN` | so com `asaas` | token definido no painel do Asaas |
| `PERMITIR_PSP_MOCK` | so na vitrine | `sim` |

Depois de configurar `DATABASE_URL`, rode as migrations contra o banco de
producao a partir da sua maquina:

```bash
DATABASE_URL="<url-de-producao>" npx prisma migrate deploy
DATABASE_URL="<url-de-producao>" npx prisma db seed
```

### Vitrine de demonstracao

Enquanto a conta no Asaas nao existe (Fase 0), da para publicar um ambiente de
demonstracao com `PSP_PROVIDER=mock` e `PERMITIR_PSP_MOCK=sim`.

A trava que impede mock em producao continua valendo: sem a variavel escrita a
mao, o deploy falha. O ponto dela e nunca cair em mock por **omissao**, e
esquecimento nunca produz a string `sim`. Com a vitrine ligada, toda tela -
inclusive a pagina publica de pagamento - exibe uma faixa avisando que nenhuma
cobranca ali e real.

**Desligue `PERMITIR_PSP_MOCK` no dia em que o Asaas entrar.**

---

## Colocando em producao

### 1. Conta no Asaas

Preencha no `.env` (ou nas variaveis de ambiente da Vercel):

```
PSP_PROVIDER="asaas"
ASAAS_API_BASE="https://api.asaas.com/v3"
ASAAS_API_KEY="<chave>"
ASAAS_WEBHOOK_TOKEN="<token que voce definir no painel do Asaas>"
```

Nenhuma linha de codigo muda. A aplicacao **se recusa a subir** com
`PSP_PROVIDER=mock` e `NODE_ENV=production` - um deploy esquecido nesse estado
emitiria cobrancas que nunca caem na conta.

### 2. Webhook no painel do Asaas

Aponte para `https://pay.paivast.com.br/api/webhooks/asaas` e configure o mesmo
token do `ASAAS_WEBHOOK_TOKEN`.

### 3. Reconciliacao diaria

`vercel.json` ja agenda o cron para 9h. Defina `CRON_SECRET` nas variaveis de
ambiente - a Vercel o envia automaticamente no header `authorization`.

### 4. Banco

`npx prisma migrate deploy` contra o Postgres de producao (Neon ou Supabase).
Configure backup diario com retencao minima de 30 dias (secao 11).

---

## O que ainda nao existe

Fora do escopo desta entrega, conforme o faseamento da secao 12:

- **Fase 2**: e-mail transacional (o envio automatico de cobranca, lembrete e
  recibo esta modelado no historico de eventos, mas nada e enviado ainda),
  cobranca recorrente, recibo em PDF, recuperacao de senha por e-mail
- **Fase 3**: edicao das configuracoes pela tela, gestao de usuarios pelo painel

E deliberadamente fora da v1 inteira: saldo, saque, conta para terceiros
receberem e armazenamento de cartao. Se em algum momento surgir a necessidade de
um saldo intermediario, **pare e consulte o Umberto antes de implementar** -
guardar dinheiro de terceiros, mesmo por um dia, exige autorizacao do Banco
Central.

---

## Nota sobre dependencias

`npm audit` reporta 4 vulnerabilidades altas em `mysql2` e `deepmerge-ts`, ambas
dependencias transitivas do **CLI do Prisma** (devDependency). Nenhuma alcanca o
runtime de producao, e `mysql2` sequer e carregado - o projeto usa PostgreSQL.
Resolve-las exigiria voltar ao Prisma 6, uma mudanca com quebra de
compatibilidade. Reavaliar quando o Prisma 8 estabilizar.

O `latest` do Prisma no npm aponta hoje para um release candidate (`8.0.0-rc`).
As versoes estao fixadas em `7.10.0` de proposito.
