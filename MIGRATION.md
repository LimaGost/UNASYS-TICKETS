# Migração: Base44 → Stack própria (Node.js + PostgreSQL + VPS Hostinger)

Documento de acompanhamento da migração do sistema **Unasys Tickets** para fora
da plataforma low-code Base44, rodando em infraestrutura própria. Atualizado
conforme o projeto avança.

## Objetivo

Sair 100% do Base44 (nenhuma dependência de `@base44/sdk`, nenhuma chamada a
`*.base44.app`) e ter um backend + banco de dados próprios, hospedados numa
VPS da Hostinger, mantendo o frontend React existente com o mínimo de
reescrita possível.

## Decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Backend | Node.js 20+ / Express / TypeScript | Mesma linguagem do front; o backend original (funções Deno) já era TypeScript, então a portabilidade da lógica é quase 1:1 |
| ORM | Prisma | Migrations versionadas, type-safety, bom suporte a colunas JSON |
| Banco de dados | **PostgreSQL** (decidido depois, inicialmente havia sido cogitado MySQL) | Já provisionado na VPS via painel **CloudPanel** |
| Autenticação | JWT (access token 15min + refresh token 7 dias) com e-mail/senha (bcrypt) | Substitui o `base44.auth`; sem auto-registro público, só admin cria contas |
| Autorização | "Policy layer" própria em `server/src/policies/` | Reimplementa as regras de RLS (Row-Level Security) que cada entidade tinha no Base44 |
| Hospedagem | VPS Hostinger (`srv1879086.hstgr.cloud`), painel CloudPanel | Já contratada pelo usuário |
| IA/LLM (parseEmailToTicket, improveArticleWithAI, syncNotionKnowledge) | **Adiado** para uma fase futura | Decisão do usuário - não é core do sistema |
| Sync de e-mail do Gmail | Polling via cron (a cada poucos minutos), não Pub/Sub em tempo real | Mais simples de manter numa VPS própria |
| Stripe | Fora do escopo | Confirmado que não há uso real no código (dependência morta no `package.json`) |

## Levantamento do sistema original (Base44)

Antes de escrever qualquer código, foi feito um inventário completo do que
existia na plataforma Base44:

- **48 entidades** (`base44/entities/*.jsonc`) — schema de dados + regras de RLS
- **60 funções serverless** (`base44/functions/*/entry.ts`, Deno) — lógica de
  negócio (SLA, automações, e-mail, WhatsApp, relatórios, integração com o
  CRM "Unasys Flow")
- **Frontend React** (~300 arquivos): todo o acesso a dados passa por um
  único arquivo, [src/api/base44Client.js](src/api/base44Client.js), no
  padrão `base44.entities.X.list/filter/get/create/update/delete` e
  `base44.functions.invoke(nome, payload)` — essa uniformidade é o que torna
  viável trocar o backend inteiro sem reescrever as telas.

## O que já foi construído (Fase 1 — Fundação)

Pasta nova: [server/](server/) (projeto Node.js separado do frontend).

### Banco de dados
- [server/prisma/schema.prisma](server/prisma/schema.prisma): as 48 entidades
  viradas em 48 tabelas PostgreSQL, mantendo os mesmos nomes de campo do
  Base44 (`created_date`, `updated_date`, etc.) para a API responder no
  formato que o frontend já espera.
- IDs mantidos como UUID (`String @id @default(uuid())`) para preservar
  compatibilidade na futura migração de dados.
- Sem foreign keys formais entre tabelas (o Base44 original também não
  tinha) — simplificação deliberada da Fase 1.
- **Tabelas já criadas no banco real da VPS** via `prisma db push` (o
  usuário do banco não tem permissão de criar "shadow database", então
  `prisma migrate dev` não pôde ser usado; ficou registrado como pendência
  para quando quisermos migrations versionadas de verdade).

### Autenticação (`server/src/auth/`)
- Login por e-mail/senha, hash com bcrypt.
- JWT de acesso (15min) + refresh token (7 dias, cookie httpOnly).
- Sem auto-registro público — só admin cria novos usuários
  (`POST /api/auth/register`).
- Script de bootstrap (`prisma/seed.ts`) para criar o primeiro admin.

### Autorização / Policy layer (`server/src/policies/`)
- `engine.ts`: padrões reutilizáveis que cobrem a maioria das regras de RLS
  do Base44 (`adminOnly`, `verticalScoped`, `ownerScoped`, `parentScoped`,
  `ticketScoped`, `knowledgeScoped`, etc.)
- `registry.ts`: as 48 entidades mapeadas para sua policy correspondente.
- Durante a implementação, foi identificada e corrigida uma lacuna de
  segurança: em entidades onde a regra de leitura é mais aberta que a de
  escrita (ex: `KnowledgeArticle`, `TicketType`, `ResponseTemplate`,
  `EtapaImplantacao`, exclusão de `Ticket`), faltava uma restrição própria
  para update/delete — corrigido com `mutateWhere`/`canDelete` explícitos.

### API (`server/src/entities/`, `server/src/uploads/`)
- CRUD genérico (`/api/entities/:entity`) que atende as 48 entidades sem
  precisar de 48 controllers manuais - guiado pelo registry de policies.
- Upload de arquivo (`/api/uploads`) substituindo `Core.UploadFile`.
- Placeholder em `server/src/functions/routes.ts` para as rotas de função de
  negócio ainda não portadas (Fases 3-4).

### Frontend
- [src/api/apiClient.js](src/api/apiClient.js): novo client com **exatamente
  a mesma interface** do `base44Client.js` antigo. Ainda não conectado às
  telas (isso é o corte de produção da Fase 5) — hoje as telas continuam
  usando o Base44 normalmente.

## O que já foi construído (Fase 2 — Tickets / Kanban / SLA / Automação)

Pasta [server/src/functions/](server/src/functions/), organizada por domínio.
Cada função virou um "core" (função TypeScript pura, chamável direto por
outras partes do backend sem round-trip HTTP) + um handler Express fino que
expõe isso em `/api/functions/:nome` quando o frontend precisa chamar via
`functions.invoke`.

| Função original (Base44) | Onde ficou | Observação |
|---|---|---|
| `updateTicketStatus` | `functions/tickets/updateTicketStatus.ts` | Recalcula SLA, cria evento, notifica responsável, dispara automações, sincroniza com o CRM. Envio de e-mail fica num stub (Fase 3) |
| `executeAutomationRules` | `functions/automation/executeAutomationRules.ts` | Motor de automação (atribuir, mudar status, notificar, mudar urgência, comentar) |
| `checkSLAAndAutomation` | `functions/automation/checkSLAAndAutomation.ts` | Vira job de cron (15 em 15 min) em vez de automação agendada do Base44 |
| `checkSLABreached` | `functions/automation/checkSLABreached.ts` | Job de cron (30 em 30 min) |
| `createTicketFromExternal` | `functions/tickets/createTicketFromExternal.ts` | **Endurecido**: a versão original não tinha nenhuma checagem de autenticação no código; portada exigindo o mesmo token de webhook usado por `receiveSalesData`/`consultarStatusTicket` |
| `recomputeTicketHours` | `functions/tickets/recomputeTicketHours.ts` | Vira hook automático (roda sempre que um `TimeEntry` é criado/editado/apagado), em vez de precisar ser disparado manualmente |
| `onTicketCreated` | `functions/hooks/onTicketCreated.ts` | Vira hook automático em `Ticket.create`. A numeração sequencial do `ticket_number` que essa função fazia manualmente **não existe mais** - o Postgres atribui isso nativamente (coluna auto-increment) |
| `criarClienteAoNovoTicket` | `functions/hooks/criarClienteAoNovoTicket.ts` | Vira hook automático em `Ticket.create` |
| `criarClienteImplantacaoAposClient` | `functions/hooks/criarClienteImplantacaoAposClient.ts` | Vira hook automático em `Client.create` |
| `atualizarProgressoImplantacao` | `functions/implantacao/atualizarProgressoImplantacao.ts` | Vira hook automático em `ProgressoItem.create`/`update` |
| `avancarKanbanAposTreinamento` | `functions/implantacao/avancarKanbanAposTreinamento.ts` | Rota de função normal (chamada explicitamente) |
| `createNotification` | `functions/notifications/createNotification.ts` | Dependência usada por quase todas as funções acima |
| `backfillTicketNumbers` | *(não portada - obsoleta)* | Só existia para corrigir numeração manual; com auto-increment nativo do Postgres, não é mais necessária |

**Sistema de hooks novo** (`server/src/entities/hooks.ts`): como o Base44
disparava automações reagindo a eventos de entidade (`Ticket.create`,
`Client.create`, etc.) e o CRUD genérico não tem esse conceito nativamente,
foi criado um registro simples de hooks `afterCreate`/`afterUpdate`/
`afterDelete` por entidade, chamado pelo controller genérico
(`server/src/entities/controller.ts`) depois de cada operação. Falha num
hook nunca derruba a resposta principal (mesma resiliência que as
automações originais tinham).

**Validado de ponta a ponta** contra o banco real da VPS: criação de ticket
disparando os hooks corretos (Client criado automaticamente), mudança de
status recalculando SLA e criando evento, e as duas rotas de checagem de SLA
respondendo corretamente. Todo o backend passa em `tsc --noEmit` sem erros.

## Infraestrutura provisionada

- **VPS Hostinger** (`srv1879086.hstgr.cloud`), gerenciada via painel
  **CloudPanel**.
- **PostgreSQL** instalado na VPS, banco `unasys_tickets_db` criado, com
  usuário de aplicação dedicado (`unasys_tickets`) — acesso **não exposto à
  internet**, só via túnel SSH (mesma configuração usada no DBeaver).
- Para desenvolvimento local, o backend roda no Windows do usuário e se
  conecta ao Postgres da VPS através de um túnel SSH local:
  ```powershell
  ssh -L 5432:localhost:5432 root@srv1879086.hstgr.cloud -p 22
  ```
  (essa janela precisa ficar aberta enquanto o backend estiver rodando)
- `server/.env` configurado localmente (não versionado) com a
  `DATABASE_URL`, segredos JWT gerados aleatoriamente, e demais variáveis
  (documentadas em [server/.env.example](server/.env.example)).

## Validação feita

Testado de ponta a ponta contra o banco real da VPS:

| Teste | Resultado |
|---|---|
| `npm install` + `prisma generate` | ✅ |
| `prisma db push` (criação das 48 tabelas) | ✅ |
| Criação do usuário admin (`prisma/seed.ts`) | ✅ |
| `GET /health` | ✅ `{"ok": true}` |
| `POST /api/auth/login` | ✅ retorna `access_token` + dados do usuário |
| `GET /api/entities/Vertical` (autenticado) | ✅ responde (0 registros - banco ainda vazio de dados) |
| `tsc --noEmit` (type-check completo do backend) | ✅ sem erros |
| Criar `Ticket` via CRUD genérico → hook cria `Client` automaticamente | ✅ |
| `POST /api/functions/updateTicketStatus` → SLA recalculado + `TicketEvent` criado | ✅ |
| `POST /api/functions/checkSLAAndAutomation` / `checkSLABreached` | ✅ |
| `checkGmailAuth`/`fetchMetabotChats` sem credenciais → erro claro, não quebra | ✅ |
| `metabotWebhook` sem token → 401 | ✅ |
| Criar `Aviso` → hook notifica usuários internos (`notifyAvisoCreatedHook`) | ✅ |
| Reatribuir `Ticket` (PUT genérico) → hook notifica novo responsável (`notifyAssignmentHook`) | ✅ |
| Criar `TicketEvent` de comentário → hook notifica responsável (`notifyNewCommentHook`) | ✅ |

Usuário admin criado: `admin@unasyshub.com.br` (senha inicial definida no
setup - trocar via `POST /api/auth/change-password`).

## O que já foi construído (Fase 3 — Gmail / WhatsApp-Metabot / Notificações)

Antes de portar, foi feito um levantamento de quais das ~16 funções de
e-mail e ~8 de WhatsApp do Base44 eram **realmente chamadas pelo frontend**
(`grep` por `functions.invoke` em `src/`). Isso revelou bastante duplicação e
código morto no sistema original:

- Existiam **5 implementações sobrepostas** para "verificar respostas de
  e-mail" (`checkTicketEmails`, `checkIncomingEmails`, `processEmailResponses`,
  `processThreadEmails`, `syncTicketThread`). Só `checkTicketEmails` era
  chamada pela UI (tela do ticket) e era também a mais robusta (resolução de
  thread por múltiplas estratégias). As outras 4 foram descartadas -
  consolidamos numa função só, incorporando o que tinham de útil (ex: a
  notificação ao analista responsável, que só `processEmailResponses` fazia).
- **8 funções de WhatsApp/finalização de atendimento**
  (`finalizarAtendimentoComTicket`, `finalizeWhatsAppAttendance`,
  `finalizarWhatsAppAtendimento`, `transferMetabotChat`,
  `vincularWhatsAppImplantacao`, `captureAndSaveConversation`,
  `syncTicketSessionToEvent`) **não são chamadas por nenhum lugar do
  frontend atual** - não foram portadas. Se alguma delas for necessária,
  é só avisar que portamos na hora.
- `notifyStatusChange` e `notifyTicketUpdate` também não foram portadas -
  a lógica delas já está coberta (de forma mais completa) pelo
  `updateTicketStatus` da Fase 2, que já notifica o responsável na própria
  mudança de status.

**Gmail** (`server/src/integrations/gmail.ts`, `server/src/functions/gmail/`):
OAuth2 via `google-auth-library` (troca `GMAIL_REFRESH_TOKEN` por access
token). Portado: `checkGmailAuth`, `listGmailMessages`, `testEmailSend`,
`sendEmailGmail` (composer com anexos e encadeamento de thread),
`sendClientEmail`, `sendCsatEmail` (agora chamada diretamente por
`updateTicketStatus` quando o ticket entra numa coluna final, em vez de
depender de uma automação separada), `checkTicketEmails` (consolidada,
citada acima). `processIncomingEmails` (criava tickets novos via IA) e
`createEmailAutomation` (configurava agendamento pela UI) viraram *stubs*
explicativos - a primeira depende de IA (Fase 7), a segunda não faz mais
sentido porque o agendamento agora é fixo em código (cron).

**WhatsApp/Metabot** (`server/src/integrations/metabot.ts`,
`server/src/functions/metabot/`): `fetchMetabotChats` (proxy genérico:
list/send/send-media/etc), `sendMetabotWhatsapp`, `metabotWebhook` (recebe
eventos do Metabot e cria/atualiza ticket - **endurecido** com o mesmo
token de webhook das outras integrações; a versão original não tinha
nenhuma autenticação).

**Notificações por evento**: o sistema de hooks da Fase 2
(`server/src/entities/hooks.ts`) ganhou suporte a `oldRecord` nos hooks de
`afterUpdate`, permitindo `notifyAssignmentHook` (dispara só quando
`assigned_to` realmente muda). `notifyNewCommentHook` dispara em
`TicketEvent.create`, `notifyAvisoCreatedHook` em `Aviso.create`.

**Ainda não configurado** (o código está pronto, falta só as credenciais):
Gmail (`GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`) e
Metabot (`METABOT_API_TOKEN`) no `server/.env`. Sem eles, as funções
correspondentes respondem com erro claro em vez de quebrar o resto do
sistema (testado).

## O que já foi construído (Fase 4 — Base de Conhecimento / Relatórios / Admin / CRM)

| Função original (Base44) | Onde ficou | Observação |
|---|---|---|
| `searchKnowledge` | `functions/knowledge/searchKnowledge.ts` | Busca simples por texto (sem IA) em título/conteúdo/resumo/tags |
| `getMyReportsData` | `functions/reports/getMyReportsData.ts` | **Nota de segurança preservada do original**: a policy de `Ticket` libera leitura pra vertical inteira (necessário pro Kanban); aqui o filtro é remontado no servidor para só devolver os tickets/apontamentos do próprio usuário, independente de role/cargo |
| `exportReportCSV` | `functions/reports/exportReportCSV.ts` | Sem mudanças de lógica, só a troca de `Deno.serve`/`Response` por `res.send()` do Express |
| `exportReportPDF` | `functions/reports/exportReportPDF.ts` | Usa `jspdf` (mesma lib do original, agora rodando em Node em vez de Deno) |
| `listInternalUsers` | `functions/admin/listInternalUsers.ts` | **Endurecido**: só retorna campos seguros do usuário (nunca `password_hash`/`refresh_token_hash` - a entidade `User` não é exposta pelo CRUD genérico por esse motivo) |
| `updateOwnProfile` | `functions/admin/updateOwnProfile.ts` | O campo `email_signature_fields` (dados estruturados do editor de assinatura) não foi trazido para o schema - o editor de assinatura no frontend precisa salvar só o HTML final em `email_signature` (ajuste a fazer na Fase 5) |
| `updateUserProfile` | `functions/admin/updateUserProfile.ts` | Admin edita papel/vertical/cargo de outro usuário |
| `consultarStatusTicket` | `functions/crm/consultarStatusTicket.ts` | Webhook consultado pelo CRM Unasys Flow - protegido por `WEBHOOK_SECRET_TOKEN` (já era assim no original) |
| `receiveSalesData` | `functions/crm/receiveSalesData.ts` | Webhook que cria Cliente + ClienteImplantacao + Ticket a partir de uma venda no CRM. Validação de CNPJ (dígitos verificadores) preservada |
| `testUnasysFlow` | `functions/crm/testUnasysFlow.ts` | Utilitário admin-only para testar o fluxo do CRM sem precisar de um webhook real |
| `syncTicketSessionToEvent` | `functions/hooks/syncTicketSessionToEvent.ts` | Vira hook automático em `TicketSession.update` (quando o cronômetro do ticket é encerrado) |
| `sendPlatformMessage` | *(não portada)* | Endpoint de WhatsApp redundante com `sendMetabotWhatsapp` (usa uma API antiga do Metabot) e não é chamada por nenhum lugar do frontend atual |

**Correção retroativa importante**: ao portar as funções do CRM, foi
identificado que `createTicketFromExternal` (Fase 2) e `metabotWebhook`
(Fase 3) criavam tickets diretamente via Prisma, sem passar pelo CRUD
genérico - e por isso **não disparavam os hooks** de `Ticket.create`
(notificar analistas da vertical, etc.), já que o sistema de hooks só
estava plugado no controller genérico. As três funções (essas duas +
`receiveSalesData`, nova) agora chamam `runAfterCreate('Ticket', ...)`
explicitamente depois de criar o ticket, restaurando a paridade com o
comportamento original do Base44 (onde a automação reagia ao evento da
entidade, não importa qual código disparou a criação).

**Validado de ponta a ponta** contra o banco real (via túnel): login,
listagem de usuários, busca na base de conhecimento, exportação CSV/PDF
(tamanho de arquivo conferido), atualização de perfil, e os três endpoints
do CRM (`testUnasysFlow` criando ticket de implantação corretamente com
`main_type: "implantacao"`, `consultarStatusTicket` respondendo o status
normalizado, `receiveSalesData` criando Cliente+ClienteImplantacao+Ticket e
rejeitando CNPJ inválido com 400). `tsc --noEmit` sem erros.

## Deploy em produção (adiantado da Fase 6)

A pedido do usuário, o backend foi colocado no ar na VPS antes de terminar
as fases de funcionalidade restantes (4 e 5) - decisão consciente de
validar a infraestrutura de produção cedo.

- **URL pública**: `https://tickets.unasyshub.com.br` (domínio próprio,
  configurado depois - ver "Domínio próprio" abaixo). O hostname original
  da Hostinger, `https://srv1879086.hstgr.cloud`, continua funcionando em
  paralelo (mesmo site, mesmo certificado, os dois nomes respondem)
- **Site criado via CloudPanel** (tipo "Node.js"), que provisionou:
  - Node.js 24 LTS via `nvm`, isolado por usuário de site (`hstgr-srv1879086`)
  - Vhost Nginx com proxy reverso para `localhost:3001`
  - Certificado **Let's Encrypt** (HTTPS real, renovação automática pelo CloudPanel)
- **Código-fonte** copiado via `scp` (sem `node_modules`/`dist` - instalados
  direto na VPS para pegar os binários corretos de Linux, incluindo o
  Prisma Client)
- **Processo mantido no ar com PM2** (`pm2 start dist/index.js --name unasys-api`),
  configurado para reiniciar automaticamente em caso de queda e no boot da
  VPS (`pm2 startup` registrado como serviço `systemd` + `pm2 save`)
- **`.env` de produção** com segredos JWT/webhook **diferentes** dos usados
  em desenvolvimento local, e `DATABASE_URL` apontando para
  `localhost:5432` (API e banco na mesma máquina agora - não depende mais
  do túnel SSH, que continua necessário só para o ambiente de
  desenvolvimento local no Windows)

**Detalhe técnico do deploy** que vale registrar: o usuário de site do
CloudPanel (`hstgr-srv1879086`) só tem acesso SFTP/SCP, não abre um shell
SSH completo (`ssh` direto nele dá "Permission denied") - por isso os
comandos (`npm install`, `pm2`, etc.) foram rodados via `root`, trocando
para o usuário do site com `su - hstgr-srv1879086` (herda o ambiente
`nvm`/Node correto e mantém a posse dos arquivos certa, sem precisar de
`chown` depois).

**Validado em produção**: `GET /health`, `POST /api/auth/login` e uma
chamada autenticada a `GET /api/entities/Vertical`, todos via HTTPS
público, de fora da VPS.

**Nota histórica**: no momento em que este deploy foi feito, o frontend
ainda estava 100% no Base44 (Fase 5 não tinha começado) - essa API pública
ainda não estava sendo usada por nenhuma tela, era infraestrutura pronta e
testada esperando o resto do sistema. Isso mudou na Fase 5 (o corte já
aconteceu localmente) - falta só publicar o frontend cortado e as Fases 4-5
do backend nessa mesma VPS (ver Fase 6 no roadmap).

**Nota**: o código da Fase 4 (Base de Conhecimento/Relatórios/Admin/CRM)
foi validado localmente, mas **ainda não foi publicado na VPS** - o
deploy em produção descrito acima é só até o fim da Fase 3. Repetir os
passos de "Publicar uma atualização de código" (seção de Acessos e
operação, abaixo) quando quiser levar a Fase 4 para produção.

## Domínio próprio (`tickets.unasyshub.com.br`)

Depois do deploy inicial (que usava só o hostname `srv1879086.hstgr.cloud`
da Hostinger), configuramos o domínio próprio da empresa:

1. **DNS**: registro `A` criado no provedor de DNS do domínio
   `unasyshub.com.br` (gerenciado fora da Hostinger) - `tickets` apontando
   para o IP da VPS (`179.198.111.151`).
2. **CloudPanel → Vhost**: esse CloudPanel não tem uma aba "Domains"
   separada - domínios adicionais de um site se adicionam direto no editor
   de Vhost (aba **Vhost** do site), incluindo o novo domínio na diretiva
   `server_name` do bloco `server` principal (não no bloco de redirect do
   `www`).
3. **SSL**: novo certificado Let's Encrypt emitido incluindo os dois
   domínios juntos (`srv1879086.hstgr.cloud` + `tickets.unasyshub.com.br`)
   - mesma pegadinha do `www` de antes (não adicionar `www.tickets...` à
   lista, já que não existe registro DNS para esse subdomínio).
4. **Depois de qualquer mudança no Vhost/SSL**: rodar `nginx -t &&
   systemctl reload nginx` como `root` - o CloudPanel às vezes não recarrega
   sozinho na hora.
5. **Backend**: `API_PUBLIC_URL` e `APP_PUBLIC_URL` no `.env` de produção
   atualizados de `https://srv1879086.hstgr.cloud` para
   `https://tickets.unasyshub.com.br` (afeta o link de arquivos anexados e
   o link do e-mail de pesquisa de satisfação/CSAT enviado ao cliente).

Os dois domínios (`tickets.unasyshub.com.br` e `srv1879086.hstgr.cloud`)
continuam respondendo - é o mesmo site, mesmo certificado.

## O que já foi construído (Fase 5 — Corte do frontend para a API própria)

Esta é a fase que efetivamente tira o frontend do Base44. Como todo o acesso
a dados das ~300 telas passa por um único arquivo
([src/api/base44Client.js](src/api/base44Client.js)), o "corte" técnico foi
trocar o conteúdo desse arquivo pelo cliente próprio - mas antes disso foi
preciso reconstruir tudo que dependia do fluxo de autenticação externo do
Base44 (login por redirect para `*.base44.app`).

**Tela de login nova** ([src/pages/Login.jsx](src/pages/Login.jsx)):
formulário e-mail/senha simples, usa `useAuth().login()`, redireciona de
volta para a página que o usuário tentou acessar (`from_url`), erros
mostrados via toast (`sonner`). Sem "esqueci minha senha" por e-mail ainda -
ver observação sobre `inviteUser` abaixo.

**`AuthContext` reescrito** ([src/lib/AuthContext.jsx](src/lib/AuthContext.jsx)):
antes redirecionava para o Base44 checar sessão externamente; agora chama
`base44.auth.me()` (JWT) direto no próprio backend. Mantém os mesmos nomes de
campo que as telas já usavam (`user`, `isAuthenticated`, `isLoadingAuth`,
`login`, `logout`, `navigateToLogin`, `checkUserAuth`) - `isLoadingPublicSettings`
e `appPublicSettings` (conceito de "configurações públicas da plataforma" que
só existia no Base44) ficaram como stubs (`false`/`null`) só para não quebrar
telas que ainda checam esses campos.

**`App.jsx`**: adicionada rota `/login` fora do gate de autenticação; o resto
do app (`AuthenticatedApp`) checa `isLoadingAuth` e redireciona para
`/login` via `<Navigate>` quando `!isAuthenticated`, antes de renderizar as
rotas internas (que continuam protegidas por `InternalGuard`, sem mudança).

**`src/api/apiClient.js` → virou o `base44Client.js`**: o arquivo novo tinha
sido escrito na Fase 1 em paralelo, sem tocar nas telas. Nesta fase, seu
conteúdo substituiu de fato o `base44Client.js` (mesmo nome de export
`base44`, então nenhuma das ~300 telas precisou mudar uma linha sequer).
Ajustes feitos durante a validação:
- `functions.invoke()` agora devolve `{ data: resultado }` (o SDK original do
  Base44 tinha esse formato tipo-axios, e várias telas já faziam `res.data`)
- `auth.updateMe(data)` adicionado (perfil do próprio usuário)
- Stubs no-op para funcionalidades que não existem no backend próprio:
  `appLogs.logUserInApp` (analytics do Base44), `asServiceRole.listAutomations`/
  `manageAutomation` (agendamento agora é cron fixo em código, não mais
  configurável pela UI), `users.inviteUser` (cria a conta direto com senha
  temporária aleatória, já que não há fluxo de e-mail de convite ainda - o
  admin precisa repassar a senha manualmente)
- **`entities.<Nome>.subscribe()` adicionado como no-op** — bug real
  encontrado na validação em navegador, ver abaixo.

**Dependências do Base44 removidas** do `package.json` raiz:
`@base44/sdk` e `@base44/vite-plugin`. Esse plugin escondia duas coisas que
teve que repor manualmente em [vite.config.js](vite.config.js): o alias `@`
apontando para `src/` (senão o Vite não resolve nenhum import `@/...`) e o
`logLevel: 'error'` (supressão de warnings).

**Schema**: campo `avatar_url` adicionado ao model `User` (usado pela tela de
perfil, não estava mapeado ainda).

**Bug real encontrado e corrigido na validação em navegador**: o componente
`NotificationBell.jsx` chama `base44.entities.Notification.subscribe(callback)`
dentro de um `useEffect`, esperando atualização em tempo real (o SDK do
Base44 tinha um canal de websocket pra isso). O client novo não tinha esse
método - a chamada lançava `TypeError: ...subscribe is not a function` dentro
do efeito, sem nenhum Error Boundary pra conter, e isso desmontava a árvore
React inteira: **tela em branco depois do login**, sem nenhum erro visível na
UI (só no console). Corrigido adicionando um `subscribe()` no-op (retorna uma
função de "unsubscribe" vazia) no client - não precisou de mais nada porque o
próprio `NotificationBell` já faz polling via `refetchInterval: 5000` do
React Query, então a atualização de notificações continua funcionando, só sem
o canal em tempo real extra.

**Validado em navegador real** (Playwright, headless Chromium, contra o
backend local + túnel SSH para o banco da VPS):
| Teste | Resultado |
|---|---|
| `/` sem sessão → redireciona para `/login`, formulário renderiza | ✅ |
| Login com `admin@unasyshub.com.br` → redireciona para `/` | ✅ |
| Dashboard ("Meu Perfil") renderiza completo (sidebar, widgets, dados do usuário) | ✅ |
| Navegar para outra tela (Implantação) sem crash | ✅ |
| Nenhum `pageerror` (crash React) durante todo o fluxo | ✅ (depois da correção do `subscribe`) |
| 2x `401` no console durante o carregamento inicial | ✅ esperado - é o `AuthContext`/`NotificationBell` checando sessão antes do login existir, tratado como "precisa logar", não é erro |

**Ainda não testado nesta fase** (fica para quando o usuário for usar de
verdade): fluxos de criação/edição de ticket, upload de arquivo, telas de
relatórios/CRM/admin no navegador (só foram validadas via chamada HTTP direta
nas Fases 3-4).

## Roadmap - próximos passos

| Fase | Escopo | Status |
|---|---|---|
| 1 | Fundação: schema, auth, autorização, CRUD genérico | ✅ Concluída |
| 2 | Portar funções de negócio - Tickets, Kanban, SLA, automações | ✅ Concluída |
| 3 | Portar integrações - Gmail, WhatsApp/Metabot, notificações por evento | ✅ Concluída (falta configurar credenciais Gmail/Metabot) |
| 4 | Portar Base de Conhecimento (sem IA), Relatórios (PDF/CSV), Admin/Config, CRM Unasys Flow | ✅ Concluída (validada local; falta publicar na VPS) |
| 5 | Cortar o frontend para a API própria: criar tela de login, reescrever `AuthContext`, substituir `base44Client.js` pelo `apiClient.js` | ✅ Concluída (validada em navegador local; falta publicar na VPS) |
| 6 | Migração dos dados existentes do Base44 → PostgreSQL, e publicar Fases 4/5 na VPS | Fases 1-5 publicadas na VPS (backend completo + frontend cortado servidos em `https://srv1879086.hstgr.cloud`) / dados antigos do Base44 ainda não migrados |
| 7 (opcional) | Reintroduzir IA (parseEmailToTicket, improveArticleWithAI, syncNotionKnowledge) com Anthropic/OpenAI | Adiada |

## Acessos e operação (runbook)

> **Este guia foi movido para [OPERACAO.md](OPERACAO.md)** — manual de
> operação do dia a dia (acessar o banco, publicar mudanças de código,
> operar o servidor, CloudPanel). Este documento (`MIGRATION.md`) continua
> só com o histórico técnico da migração. As senhas e segredos reais ficam
> em [CREDENTIALS.md](CREDENTIALS.md) (arquivo local, no `.gitignore`,
> nunca versionado).

Ver [OPERACAO.md](OPERACAO.md) para todos os detalhes práticos (endereços,
contas de acesso, comandos, problemas comuns).
