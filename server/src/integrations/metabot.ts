import { env } from '../config/env';

export const METABOT_BASE_URL = 'https://api.metabot.com.br/core/v2/api';

export function metabotHeaders(): Record<string, string> {
  if (!env.metabotApiToken) {
    throw new Error('METABOT_API_TOKEN não configurado');
  }
  return { 'Content-Type': 'application/json', 'access-token': env.metabotApiToken };
}

export function metabotConfigured(): boolean {
  return !!env.metabotApiToken;
}
