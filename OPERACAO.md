# Manual de Operação — Unasys Tickets

Guia do dia a dia: como acessar o banco de dados, como publicar uma mudança
de código, e como as peças se conectam (seu PC → Hostinger → servidor). As
senhas reais ficam separadas, em [CREDENTIALS.md](CREDENTIALS.md) (nunca
versionado) — aqui é só o "como fazer".

Para o histórico técnico da migração (o que foi construído em cada fase),
ver [MIGRATION.md](MIGRATION.md). Este documento aqui é só operação.

## 1. Como o sistema é organizado

Quatro peças, cada uma com um papel diferente:

| Peça | O que é | Quando você mexe nela |
|---|---|---|
| **Seu PC** | Onde você edita o código (com ajuda do Claude Code) e testa antes de publicar | Sempre que for mudar alguma coisa |
| **VPS da Hostinger** | O computador na nuvem onde o sistema roda de verdade, 24h | Quando publica uma mudança, ou quando algo trava e precisa reiniciar |
| **CloudPanel** | Painel visual (site) pra administrar a VPS sem precisar saber Linux de cor - domínios, SSL, ver arquivos | Configuração de infraestrutura (domínio, certificado, etc.) - raramente no dia a dia |
| **PostgreSQL** | O banco de dados, instalado dentro da própria VPS | Quando quer consultar/editar dados diretamente (em vez de pela tela do sistema) |

Fluxo típico de uma mudança: **você edita no PC → testa local → envia pra
VPS → reinicia o processo lá → pronto, está no ar**. Não existe "aprovação"
nem "build automático" no meio - é você (ou o Claude Code, com sua
autorização) quem aciona cada passo manualmente, via terminal.

**Sobre "commit"**: hoje este projeto **não tem controle de versão (Git)**
configurado - ou seja, não existe um histórico de commits, branches, nem
backup automático das mudanças de código. Publicar uma mudança aqui
significa literalmente copiar os arquivos pro servidor (via `scp`), não
"dar commit e fazer deploy" como em projetos com Git+CI/CD. Se quiser
isso (recomendável, é uma rede de segurança boa de ter), é só pedir pra
configurar um repositório Git - pode ficar só local no seu PC (com backup
em algum lugar) ou num serviço como GitHub/GitLab.

## 2. Acessar o banco de dados

O banco (`unasys_tickets_db`, PostgreSQL) roda **dentro da VPS** e não é
acessível diretamente da internet, por segurança. Duas formas de acessar:

### Opção A — Programa gráfico no seu PC (recomendado no dia a dia)

Ferramentas como **DBeaver**, **TablePlus** ou **pgAdmin** dão uma interface
visual pra ver/editar tabelas, tipo uma planilha.

1. Abra um PowerShell e **deixe essa janela aberta** (é um túnel, se fechar
   a janela o acesso cai):
   ```powershell
   ssh -L 5432:localhost:5432 root@srv1879086.hstgr.cloud -p 22
   ```
2. No seu programa de banco de dados, crie uma conexão nova com:
   | Campo | Valor |
   |---|---|
   | Host | `localhost` |
   | Porta | `5432` |
   | Banco | `unasys_tickets_db` |
   | Usuário | `unasys_tickets` |
   | Senha | (ver [CREDENTIALS.md](CREDENTIALS.md)) |
3. Enquanto a janela do túnel (passo 1) estiver aberta, o programa de banco
   conecta normalmente, como se o banco estivesse no seu PC.

### Opção B — Direto pelo terminal, dentro da própria VPS

Útil pra uma consulta rápida sem instalar programa nenhum:

```powershell
ssh root@srv1879086.hstgr.cloud
```
```bash
su - hstgr-srv1879086
psql "postgresql://unasys_tickets:SENHA@localhost:5432/unasys_tickets_db"
```
(troque `SENHA` pela senha real, em [CREDENTIALS.md](CREDENTIALS.md) - ela
tem um `@` no meio, então dentro da URL ele já vem codificado como `%40`,
copie exatamente como está lá)

Dentro do `psql`, alguns comandos úteis:
```sql
\dt              -- lista todas as tabelas
SELECT * FROM "User" LIMIT 10;   -- olha os primeiros usuários
\q               -- sai
```

**Cuidado**: mudanças feitas direto no banco (`UPDATE`, `DELETE` manual) não
passam pelas regras de negócio do sistema (validações, notificações,
recalculo de SLA etc.) - use só para consulta ou correções pontuais que
você tenha certeza do que está fazendo. Prefira sempre operar pela tela do
sistema quando possível.

## 3. Publicar uma mudança de código (deploy)

### 3.1 Mudou algo no back-end (pasta `server/`)

No seu PC, na raiz do projeto:
```powershell
scp -r server/src hstgr-srv1879086@srv1879086.hstgr.cloud:/home/hstgr-srv1879086/htdocs/srv1879086.hstgr.cloud/
```
*(se além de `src/` você também mudou `server/prisma/schema.prisma`, `server/package.json`
ou `server/package-lock.json`, inclua esses caminhos no mesmo comando também)*

Na VPS:
```bash
ssh root@srv1879086.hstgr.cloud
su - hstgr-srv1879086
cd htdocs/srv1879086.hstgr.cloud
npm install                # só se mudou package.json
npx prisma generate        # só se mudou schema.prisma
npx prisma db push         # só se mudou schema.prisma (aplica no banco real)
npm run build
pm2 restart unasys-api --update-env
curl -I http://localhost:3001/health
```

### 3.2 Mudou algo no front-end (as telas React)

No seu PC, na raiz do projeto:
```powershell
npm run build
scp -r dist hstgr-srv1879086@srv1879086.hstgr.cloud:/home/hstgr-srv1879086/htdocs/srv1879086.hstgr.cloud/frontend-dist
```

Na VPS, só precisa reiniciar (o front-end é servido pelo mesmo processo do
back-end, então um `pm2 restart` já pega os arquivos novos - mas geralmente
nem precisa, já que são arquivos estáticos servidos direto do disco):
```bash
pm2 restart unasys-api
```

**Nota técnica**: como a pasta `server/src` tem muitas subpastas, o `scp`
do Windows às vezes falha com "failed to upload directory" nesse caso
específico. Se acontecer, use o método alternativo com `tar` (empacotar
antes de enviar):
```powershell
tar -czf server-src.tar.gz -C server src
scp server-src.tar.gz hstgr-srv1879086@srv1879086.hstgr.cloud:/home/hstgr-srv1879086/htdocs/srv1879086.hstgr.cloud/
```
```bash
# na VPS
rm -rf src
tar -xzf server-src.tar.gz
rm server-src.tar.gz
```

## 4. Operar o servidor no dia a dia

Depois de `ssh root@srv1879086.hstgr.cloud` → `su - hstgr-srv1879086` →
`cd htdocs/srv1879086.hstgr.cloud`:

| O que você quer fazer | Comando |
|---|---|
| Ver se está rodando | `pm2 status` |
| Ver os logs recentes (erros, atividade) | `pm2 logs unasys-api --lines 50 --nostream` |
| Acompanhar logs "ao vivo" (Ctrl+C pra sair) | `pm2 logs unasys-api` |
| Reiniciar (depois de mudar código ou `.env`) | `pm2 restart unasys-api --update-env` |
| Parar completamente | `pm2 stop unasys-api` |
| Ligar de novo depois de parado | `pm2 start unasys-api` |
| Testar se a API responde | `curl http://localhost:3001/health` |

## 5. CloudPanel — pra que serve, quando usar

CloudPanel (`https://179.198.111.151:8443`) é o painel visual da VPS. No
dia a dia você quase não precisa dele — a maior parte das tarefas acima é
via terminal (SSH). Use o CloudPanel quando precisar de:

- **Configurar um domínio novo** (Sites → seu site → Domains)
- **Emitir certificado SSL** (Sites → seu site → SSL/TLS → Let's Encrypt)
- **Ver arquivos visualmente** sem usar terminal (Sites → seu site → File Manager)
- **Ver uso de recursos da VPS** (CPU, memória, disco) na tela inicial

## 6. Referência rápida

| O quê | Endereço / comando |
|---|---|
| Sistema em produção (o que os usuários acessam) | `https://tickets.unasyshub.com.br` (domínio próprio; `https://srv1879086.hstgr.cloud` continua funcionando também, aponta pro mesmo lugar) |
| CloudPanel | `https://179.198.111.151:8443` |
| Conectar na VPS | `ssh root@srv1879086.hstgr.cloud` |
| Túnel do banco (pra usar DBeaver etc. do PC) | `ssh -L 5432:localhost:5432 root@srv1879086.hstgr.cloud -p 22` |
| Pasta do site na VPS | `/home/hstgr-srv1879086/htdocs/srv1879086.hstgr.cloud/` |
| Senhas e segredos reais | [CREDENTIALS.md](CREDENTIALS.md) |

## 7. Problemas comuns

- **`ssh hstgr-srv1879086@...` dá "Permission denied"**: normal, esse
  usuário só tem SFTP/SCP, não abre terminal completo. Conecte como `root`
  e depois rode `su - hstgr-srv1879086`.
- **`node`/`npm`/`pm2` não encontrado como `root`**: o Node só fica
  disponível depois do `su - hstgr-srv1879086` (é instalado por usuário via
  `nvm`, não fica visível pro `root`).
- **App aparece "errored" no `pm2 status`**: quase sempre é o `.env`
  faltando alguma variável. Veja `pm2 logs unasys-api --lines 30 --nostream`
  pra achar qual.
- **Mudou o `.env` mas o comportamento não mudou**: `pm2 restart` sozinho
  às vezes não relê o `.env`. Use `pm2 restart unasys-api --update-env`.
- **Editou `.env` pelo terminal e o comando "sumiu"/travou**: provavelmente
  colou um bloco de texto com aspas que não fechou. Aperte `Ctrl+C` pra
  cancelar e recomeçar - ou use `echo 'VARIAVEL="valor"' >> .env` pra
  acrescentar uma linha só, sem abrir editor nenhum.
- **`scp` de pastas grandes falha ("failed to upload directory")**: bug
  conhecido do `scp` do Windows. Use o método com `tar` (seção 3.2 acima).
