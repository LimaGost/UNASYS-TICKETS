import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

let client: OAuth2Client | null = null;

function isConfigured(): boolean {
  return !!(env.gmail.clientId && env.gmail.clientSecret && env.gmail.refreshToken);
}

function getClient(): OAuth2Client {
  if (!client) {
    client = new OAuth2Client(env.gmail.clientId, env.gmail.clientSecret);
    client.setCredentials({ refresh_token: env.gmail.refreshToken });
  }
  return client;
}

/** Troca o refresh token por um access token válido (o google-auth-library
 * já cuida de cache/renovação internamente). */
export async function getGmailAccessToken(): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      'Gmail não configurado - defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN no .env'
    );
  }
  const { token } = await getClient().getAccessToken();
  if (!token) throw new Error('Não foi possível obter access token do Gmail');
  return token;
}

export function gmailConfigured(): boolean {
  return isConfigured();
}

/** Helper para chamar a Gmail API autenticado, path relativo a
 * /gmail/v1/users/me (ex: '/messages?q=...'). */
export async function gmailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getGmailAccessToken();
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ── Helpers de codificação/decodificação MIME ──

export function b64UrlToUtf8(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

export function decodeMimeHeader(str?: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') {
        const bin = atob(text);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder(charset).decode(bytes);
      }
      const decoded = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_h: string, h: string) => String.fromCharCode(parseInt(h, 16)));
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return text;
    }
  });
}

export function fixMojibake(s?: string): string {
  if (!s) return s ?? '';
  let cur = s;
  for (let pass = 0; pass < 2; pass++) {
    if (!/[ÃÂ]/.test(cur)) break;
    try {
      const bytes = new Uint8Array(cur.length);
      let ok = true;
      for (let i = 0; i < cur.length; i++) {
        const c = cur.charCodeAt(i);
        if (c > 0xff) {
          ok = false;
          break;
        }
        bytes[i] = c;
      }
      if (!ok) break;
      cur = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      break;
    }
  }
  return cur;
}

export type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: { name: string; value: string }[];
};

export function extractBody(payload?: GmailPayload): string {
  if (!payload) return '';
  if (payload.parts) {
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
    if (htmlPart?.body?.data) return b64UrlToUtf8(htmlPart.body.data);
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
    if (textPart?.body?.data) return b64UrlToUtf8(textPart.body.data).replace(/\n/g, '<br>');
    for (const p of payload.parts) {
      const nested = extractBody(p);
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    const raw = b64UrlToUtf8(payload.body.data);
    return payload.mimeType === 'text/plain' ? raw.replace(/\n/g, '<br>') : raw;
  }
  return '';
}

export function encodeHeader(str: string): string {
  if (!str) return '';
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

export function encodeBase64UrlUnicode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
