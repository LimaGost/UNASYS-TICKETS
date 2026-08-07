# Unasys Tickets

Sistema de helpdesk/ticketing da Unasys - frontend React (Vite).

## Rodando localmente

1. Instalar dependências: `npm install`
2. Criar um `.env.local` na raiz com a URL do backend:
   ```
   VITE_API_URL="http://localhost:3001"
   ```
3. Rodar o backend (ver [server/README.md](server/README.md)) - precisa estar
   no ar para o frontend funcionar.
4. Rodar o frontend: `npm run dev`

## Documentação

- [MIGRATION.md](MIGRATION.md) - histórico técnico da migração para stack
  própria (arquitetura, decisões, o que foi construído em cada fase).
- [OPERACAO.md](OPERACAO.md) - manual de operação do dia a dia (acessar o
  banco de dados, publicar mudanças de código, operar o servidor).
- [server/README.md](server/README.md) - setup e arquitetura do backend.
