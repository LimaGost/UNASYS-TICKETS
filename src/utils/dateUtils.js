import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

export const TZ = "America/Sao_Paulo";

// Garante interpretação como UTC quando não há offset explícito
export function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}

export function nowBrasilia() {
  return toZonedTime(new Date(), TZ);
}

export function todayBrasilia() {
  return tzFormat(toZonedTime(new Date(), TZ), "yyyy-MM-dd", { timeZone: TZ });
}

export function currentTimeBrasilia() {
  return tzFormat(toZonedTime(new Date(), TZ), "HH:mm", { timeZone: TZ });
}

export function formatHour(dateStr) {
  if (!dateStr) return "";
  try {
    return tzFormat(toZonedTime(toUTC(dateStr), TZ), "HH:mm", { timeZone: TZ });
  } catch {
    return "";
  }
}

export function formatTime(dateStr) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(toUTC(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

export function formatDateTimeBrasilia(dateStr) {
  if (!dateStr) return "";
  try {
    return tzFormat(toZonedTime(toUTC(dateStr), TZ), "dd/MM/yyyy HH:mm", { timeZone: TZ });
  } catch {
    return "";
  }
}

// Chave de data (yyyy-MM-dd) no fuso de Brasília — para agrupamentos/comparações
export function dateKeyBrasilia(dateStr) {
  if (!dateStr) return "";
  try {
    return tzFormat(toZonedTime(toUTC(dateStr), TZ), "yyyy-MM-dd", { timeZone: TZ });
  } catch {
    return "";
  }
}

export function formatDateBrasilia(dateStr) {
  if (!dateStr) return "";
  try {
    return tzFormat(toZonedTime(toUTC(dateStr), TZ), "dd/MM/yyyy", { timeZone: TZ });
  } catch {
    return "";
  }
}