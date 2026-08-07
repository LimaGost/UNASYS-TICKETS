# Manual de Operação — Unasys Tickets

Guia do dia a dia: como acessar o banco de dados, como publicar uma mudança
de código, e como as peças se conectam (seu PC → Hostinger → servidor). As
senhas reais ficam separadas, em [CREDENTIALS.md](CREDENTIALS.md) (nunca
versionado) — aqui é só o "como fazer".

Para o histórico técnico da migração (o que foi construído em cada fase),
ver [MIGRATION.md](MIGRATION.md). Este documento aqui é só operação.

## 1. Como o sistema é organizado

Cinco peças, cada uma com um papel diferente:

| Peça | O que é | Quando você mexe nela |
|---|---|---|
| **Seu PC** | Onde você edita o código (com ajuda do Claude Code) e testa antes de publicar | Sempre que for mudar alguma coisa |
| **GitHub** | Repositório Git privado (`github.com/LimaGost/UNASYS-TICKETS`) - histórico de todas as mudanças, e é de lá que a VPS busca o código | Todo `git push` depois de uma mudança |
| **VPS da Hostinger** | O computador na nuvem onde o sistema roda de verdade, 24h | Quando publica uma mudança (`git pull`), ou quando algo trava e precisa reiniciar |
| **CloudPanel** | Painel visual (site) pra administrar a VPS sem precisar saber Linux de cor - domínios, SSL, ver arquivos | Configuração de infraestrutura (domínio, certificado, etc.) - raramente no dia a dia |
| **PostgreSQL** | O banco de dados, instalado dentro da própria VPS | Quando quer consultar/editar dados diretamente (em vez de pela tela do sistema) |

Fluxo típico de uma mudança: **você edita no PC → testa local → `git commit`
+ `git push` pro GitHub → na VPS, `git pull` + rebuild + reinicia → pronto,
está no ar**. Não existe "aprovação" nem CI/CD automático no meio - é você
(ou o Claude Code, com sua autorização) quem aciona cada passo manualmente,
via terminal. Ver a seção 3 para o passo a passo completo.

**Sobre autenticação com o GitHub**: usamos chave SSH, não senha nem token.
Seu PC tem uma chave cadastrada na sua conta pessoal do GitHub (pode dar
push). A VPS tem uma chave **separada**, cadastrada como "Deploy Key" só
nesse repositório, com permissão **somente leitura** (só consegue `git
pull`, nunca `git push`) - por segurança, já que é um servidor de produção.

### Duas abas de terminal, dois papéis fixos

Pra não se perder sobre "em qual computador esse comando vai rodar", use
sempre duas abas de terminal no VS Code (ícone `+` no painel do terminal, ou
`` Ctrl+Shift+` `` pra abrir uma nova):

- **Aba 1 - seu PC**: nunca dá `ssh`. Usa pra `git add`/`commit`/`push` e
  pra editar/testar código localmente. O prompt começa com
  `PS C:\Users\...`.
- **Aba 2 - VPS**: conecta uma vez (passos abaixo) e fica conectada. Usa pra
  `git pull`, build e `pm2`. O prompt começa com
  `hstgr-srv1879086@srv1879086:...`.

### Como entrar na VPS (passo a passo)

Na **Aba 2**:

```powershell
ssh root@srv1879086.hstgr.cloud
```
Pede a senha do usuário `root` da VPS (não é a mesma coisa que a senha do
CloudPanel! essa fica salva no e-mail que a Hostinger mandou na criação da
VPS, ou em hPanel → VPS → sua VPS → opção de ver/resetar senha do root -
por segurança, essa senha nunca fica registrada nesta documentação).

Depois de conectar como `root`, troque para o usuário do site (não pede
senha - `root` pode virar qualquer usuário livremente):
```bash
su - hstgr-srv1879086
```

E entre na pasta do projeto:
```bash
cd ~/app
```

Pronto - o prompt deve mostrar algo como `hstgr-srv1879086@srv1879086:~/app$`.
Pode deixar essa aba conectada o dia inteiro; só reconecta se fechar o VS
Code ou a janela ficar muito tempo parada.

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

O código mora em `~/app` na VPS (um clone Git do repositório
`github.com/LimaGost/UNASYS-TICKETS`) - substituiu o método antigo de copiar
arquivo por arquivo via `scp`.

### 3.1 No seu PC: commitar e enviar pro GitHub

Na raiz do projeto, depois de fazer e testar suas mudanças:
```powershell
git add -A
git status              # confira o que vai ser commitado antes de seguir
git commit -m "Descreva a mudança em poucas palavras"
git push
```

### 3.2 Na VPS: baixar e publicar

```bash
ssh root@srv1879086.hstgr.cloud
su - hstgr-srv1879086
cd ~/app
git pull
```

Depois, só rode as partes que mudaram:

**Mudou algo em `server/`:**
```bash
cd ~/app/server
npm install          # só se mudou server/package.json
npx prisma generate  # só se mudou server/prisma/schema.prisma
npx prisma db push   # só se mudou server/prisma/schema.prisma (aplica no banco real)
npm run build
pm2 restart unasys-api --update-env
curl -I http://localhost:3001/health
```

**Mudou algo no front-end (`src/`, telas React):**
```bash
cd ~/app
npm install           # só se mudou package.json (raiz)
npm run build
pm2 restart unasys-api
```

**Mudou o `.gitignore`/estrutura mas não sabe o que exatamente rebuildar**:
rodar os dois blocos acima inteiros não faz mal nenhum, só demora um pouco
mais.

### 3.3 Se algo der errado no meio do caminho

- `git pull` reclamando de mudanças locais não commitadas na VPS: isso não
  deveria acontecer (a VPS só lê, nunca edita o código - só o `.env`, que
  não é rastreado pelo Git). Se acontecer, rode `git status` pra ver o que
  mudou antes de decidir descartar (`git checkout -- .`) ou guardar.
- Erro de compilação (`tsc`/`vite build` falhando) depois do `git pull`:
  quase sempre falta rodar `npm install` antes (uma dependência nova foi
  adicionada no `package.json`).

## 4. Operar o servidor no dia a dia

Depois de `ssh root@srv1879086.hstgr.cloud` → `su - hstgr-srv1879086` →
`cd ~/app`:

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
| Repositório no GitHub | `https://github.com/LimaGost/UNASYS-TICKETS` (privado) |
| CloudPanel | `https://179.198.111.151:8443` |
| Conectar na VPS | `ssh root@srv1879086.hstgr.cloud` |
| Túnel do banco (pra usar DBeaver etc. do PC) | `ssh -L 5432:localhost:5432 root@srv1879086.hstgr.cloud -p 22` |
| Pasta do código na VPS (clone Git) | `/home/hstgr-srv1879086/app/` |
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
- **Depois de instalar `git`/`gh` no Windows, o PowerShell diz "não é
  reconhecido como cmdlet"**: o PATH só é lido quando o PowerShell abre -
  feche e abra uma janela nova (ou rode `$env:Path =
  [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path","User")` pra
  atualizar sem reabrir).
- **Um arquivo de código não aparece no `git status`/não foi versionado**:
  confira se algum `.gitignore` (o da raiz ou o de `server/.gitignore`) não
  está acidentalmente escondendo ele. Regra sem barra no início (tipo
  `uploads/`) casa em **qualquer profundidade** da pasta - já aconteceu de
  isso esconder `server/src/uploads/` (código de verdade) por engano, só
  queríamos ignorar `server/uploads/` (arquivos enviados por usuários). Use
  `git check-ignore -v caminho/do/arquivo` pra descobrir qual regra está
  pegando.
