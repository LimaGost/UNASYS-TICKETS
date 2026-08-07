import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:5173',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 25),

  // Se definido, o Express também serve o build estático do frontend
  // (dist/ do Vite) nesse diretório, com fallback de SPA para rotas que não
  // são /api/*. Deixa em branco em desenvolvimento (frontend roda separado
  // via `vite`, na porta 5173).
  frontendDistDir: process.env.FRONTEND_DIST_DIR ?? '',

  webhookSecretToken: process.env.WEBHOOK_SECRET_TOKEN ?? '',
  // URL do endpoint no CRM Unasys Flow que recebe atualizações de status de ticket
  flowSyncUrl: process.env.FLOW_SYNC_URL ?? '',

  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN ?? '',
    senderEmail: process.env.GMAIL_SENDER_EMAIL ?? '',
  },

  metabotApiToken: process.env.METABOT_API_TOKEN ?? '',
  notionToken: process.env.NOTION_TOKEN ?? '',
};
