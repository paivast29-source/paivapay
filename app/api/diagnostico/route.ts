import { NextResponse } from "next/server";
import { ehVitrineDemonstracao } from "@/lib/ambiente";
import { db } from "@/lib/db";
import { urlBancoAplicacao, urlBancoMigracoes } from "@/lib/url-banco";

/**
 * Diagnostico de ambiente.
 *
 * Existe para responder, sem precisar caçar log de servidor, a pergunta que
 * aparece em todo primeiro deploy: "o banco esta configurado?".
 *
 * O sintoma que motivou esta rota engana: a tela de login abre normalmente
 * (sem cookie de sessao ela nao consulta o banco) e so quebra ao enviar o
 * formulario, quando o rate limiting faz a primeira consulta. O erro chega ao
 * usuario como um "server error" generico do Next, que nao diz nada sobre a
 * causa.
 *
 * O QUE ESTA ROTA NAO DEVOLVE, DE PROPOSITO:
 *
 *  - a connection string, nem em parte, nem o host
 *  - qualquer chave de API
 *  - mensagens de erro cruas do banco, que costumam embutir usuario e host
 *  - dados de cliente, cobranca ou valores
 *
 * Só booleanos e um punhado de rotulos fixos. E seguro deixar publica durante a
 * implantacao; ainda assim, da para remover o arquivo quando o ambiente
 * estabilizar - nada mais depende dela.
 */

export const dynamic = "force-dynamic";

type EstadoBanco =
  | "ok"
  | "variavel_ausente"
  | "inacessivel"
  | "sem_tabelas";

export async function GET() {
  let banco: EstadoBanco;
  let temAdministrador: boolean | null = null;

  if (!urlBancoAplicacao()) {
    banco = "variavel_ausente";
  } else {
    try {
      // Consulta uma tabela real: se as migrations nunca rodaram, o banco
      // responde mas a tabela nao existe - que e exatamente o caso que
      // queremos distinguir de "nao consigo conectar".
      const diretores = await db.usuario.count({ where: { papel: "diretor" } });
      banco = "ok";
      temAdministrador = diretores > 0;
    } catch (erro) {
      // P2021 = tabela inexistente; 42P01 = mesma coisa, do lado do Postgres.
      const texto = erro instanceof Error ? erro.message : String(erro);
      const semTabelas =
        texto.includes("P2021") ||
        texto.includes("42P01") ||
        texto.includes("does not exist");

      banco = semTabelas ? "sem_tabelas" : "inacessivel";

      // O erro cru vai para o log do servidor, nao para a resposta: ele
      // costuma trazer host e usuario do banco.
      console.error("[diagnostico] falha ao consultar o banco:", erro);
    }
  }

  const explicacao: Record<EstadoBanco, string> = {
    ok: "Banco conectado e com as tabelas no lugar.",
    variavel_ausente:
      "DATABASE_URL nao esta definida nas variaveis de ambiente. Configure-a e refaca o deploy.",
    inacessivel:
      "DATABASE_URL existe mas o banco nao respondeu. Pode estar suspenso por inatividade, ou a URL aponta para um host inalcancavel - localhost, por exemplo, nao funciona aqui.",
    sem_tabelas:
      "O banco respondeu, mas esta vazio: as migrations nunca foram aplicadas. Refaca o deploy - o build passou a aplica-las automaticamente.",
  };

  const proximoPasso =
    banco !== "ok"
      ? explicacao[banco]
      : temAdministrador
        ? "Tudo pronto. O login deve funcionar."
        : "Banco ok, mas nenhum usuario diretor existe. Defina SEED_ADMIN_EMAIL, SEED_ADMIN_SENHA e SEED_ADMIN_NOME nas variaveis de ambiente e refaca o deploy.";

  return NextResponse.json(
    {
      banco,
      temAdministrador,
      // Booleano apenas - a string carrega usuario e senha do banco.
      // false aqui nao e erro: significa que migrations e aplicacao usam a
      // mesma conexao, o que e o normal fora de provedor com pooler.
      conexaoDiretaSeparada: urlBancoMigracoes() !== urlBancoAplicacao(),
      psp: process.env.PSP_PROVIDER || "mock",
      vitrineDemonstracao: ehVitrineDemonstracao(),
      appUrlConfigurada: Boolean(process.env.APP_URL),
      segredoSessaoConfigurado: Boolean(process.env.SESSION_SECRET),
      proximoPasso,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
