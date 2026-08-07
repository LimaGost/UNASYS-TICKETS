# Unasys Tickets - API própria

Backend Node.js/Express/Prisma: autenticação, autorização (regras de escopo
por entidade, equivalente a Row-Level Security), CRUD genérico das 48
entidades, e as funções de negócio (tickets/SLA/automação, Gmail/WhatsApp,
notificações, base de conhecimento, relatórios, admin, CRM) em
`src/functions/`.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 14+ rodando localmente (ou acessível via rede)

## Criando o banco na VPS (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres psql -c "CREATE USER unasys WITH PASSWORD 'escolha-uma-senha-forte';"
sudo -u postgres psql -c "CREATE DATABASE unasystickets OWNER unasys;"
```

Por padrão o PostgreSQL só aceita conexões locais (via socket Unix). Se a
API vai rodar na mesma VPS (recomendado - evita expor a porta 5432 na
internet), isso já basta e `DATABASE_URL` fica:

```
DATABASE_URL="postgresql://unasys:escolha-uma-senha-forte@localhost:5432/unasystickets"
```

Se precisar acessar de outra máquina (ex: rodar migrations do seu PC),
edite `/etc/postgresql/*/main/postgresql.conf` (`listen_addresses = '*'`) e
`pg_hba.conf` (adicione uma linha `host unasystickets unasys <seu_ip>/32
scram-sha-256`), depois `sudo systemctl restart postgresql` - e libere a
porta 5432 só para o IP de origem no firewall (`ufw allow from <seu_ip> to
any port 5432`), nunca para `0.0.0.0/0`.

## Setup local

```bash
cd server
npm install
cp .env.example .env
```

Edite o `.env`:
- `DATABASE_URL`: string de conexão do seu PostgreSQL (crie o banco e o usuário antes - veja a seção "Criando o banco na VPS" acima)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: gere valores aleatórios longos, ex: `openssl rand -hex 32`

Crie as tabelas (48 entidades) a partir do schema Prisma:

```bash
npx prisma generate
npx prisma db push
```

**Nota**: usamos `db push`, não `prisma migrate`, porque o usuário do banco
normalmente não tem permissão de criar um "shadow database" (necessário
para `migrate dev`) - `db push` aplica o schema direto, sem precisar disso.

Crie o primeiro usuário admin (não há auto-registro público):

```bash
npx tsx prisma/seed.ts admin@suaempresa.com "SenhaForte123!" "Seu Nome"
```

Suba a API em modo desenvolvimento (recarrega automaticamente):

```bash
npm run dev
```

A API sobe em `http://localhost:3001` por padrão (`PORT` no `.env`).
Teste: `curl http://localhost:3001/health` deve retornar `{"ok":true}`.

## Testando login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@suaempresa.com","password":"SenhaForte123!"}'
```

Deve retornar `{ access_token, user }`. Use o `access_token` no header
`Authorization: Bearer <token>` para chamar as rotas de entidade, ex:

```bash
curl http://localhost:3001/api/entities/Vertical \
  -H "Authorization: Bearer <access_token>"
```

## Conectando o frontend

No projeto React (raiz do repo), crie/edite `.env.local`:

```
VITE_API_URL=http://localhost:3001
```

O client de acesso à API está em `src/api/apiClient.js` (raiz do repo),
usado por todas as telas no padrão `api.entities.X.list/filter/get/create/
update/delete`, `api.auth.me/login/logout`, `api.functions.invoke`,
`api.integrations.Core.UploadFile`.

Em produção, o build do frontend (`npm run build` na raiz, gera `dist/`) é
servido pelo próprio Express - configure `FRONTEND_DIST_DIR` no `.env` do
servidor apontando para essa pasta (ver [OPERACAO.md](../OPERACAO.md)).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a API com reload automático |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda a versão compilada (produção) |
| `npx prisma db push` | Aplica o schema atual no banco (usar sempre que `schema.prisma` mudar) |
| `npx prisma studio` | Abre uma UI visual para explorar o banco |

## Estrutura

```
server/
  prisma/schema.prisma      48 modelos (tabelas)
  prisma/seed.ts             cria o primeiro usuário admin
  src/
    auth/                    JWT, senha, middleware, rotas de login
    policies/                regras de autorização por entidade (escopo de leitura/escrita)
    entities/                CRUD genérico (list/get/create/update/delete) + hooks
    functions/                rotas de função de negócio (tickets, gmail, metabot, knowledge, reports, admin, crm)
    integrations/             Gmail (OAuth2), Metabot/WhatsApp
    uploads/                  upload de arquivo
    jobs/                     cron jobs (SLA, polling de e-mail)
    app.ts, index.ts          bootstrap do Express
```
