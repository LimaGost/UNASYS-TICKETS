/**
 * Calcula horas normais e extras baseado no horário de trabalho
 * @param {string} startStr - Hora de início (HH:mm)
 * @param {string} endStr - Hora de término (HH:mm)
 * @param {string} workStart - Início do expediente (HH:mm)
 * @param {string} workEnd - Fim do expediente (HH:mm)
 * @returns {object} { normal, extra, total, totalMinutes }
 */
export function calculateHours(startStr, endStr, workStart, workEnd) {
  if (!startStr || !endStr) {
    return { normal: 0, extra: 0, total: 0, totalMinutes: 0 };
  }

  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const [wsh, wsm] = workStart.split(":").map(Number);
  const [weh, wem] = workEnd.split(":").map(Number);

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const wsMin = wsh * 60 + wsm;
  const weMin = weh * 60 + wem;

  if (endMin <= startMin) {
    return { normal: 0, extra: 0, total: 0, totalMinutes: 0 };
  }

  const totalMin = endMin - startMin;

  // Calc overlap between work hours
  const overlapStart = Math.max(startMin, wsMin);
  const overlapEnd = Math.min(endMin, weMin);
  const normalMin = Math.max(0, overlapEnd - overlapStart);
  const extraMin = totalMin - normalMin;

  return {
    normal: Math.round((normalMin / 60) * 100) / 100,
    extra: Math.round((extraMin / 60) * 100) / 100,
    total: Math.round((totalMin / 60) * 100) / 100,
    totalMinutes: totalMin,
  };
}

/**
 * Formata horas para exibição
 * @param {number} hours - Horas
 * @returns {string} Formatado (1h 30m)
 */
export function formatHM(hours) {
  if (!hours || hours === 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Valida se tempo foi registrado corretamente
 * @param {object} timeEntry - TimeEntry object
 * @returns {object} { valid, errors }
 */
export function validateTimeEntry(timeEntry) {
  const errors = [];

  if (!timeEntry.ticket_id) errors.push("ticket_id is required");
  if (!timeEntry.date) errors.push("date is required");
  if (!timeEntry.start_time) errors.push("start_time is required");
  if (!timeEntry.end_time) errors.push("end_time is required");

  // Validate time format (HH:mm ou HH:mm:ss)
  if (timeEntry.start_time && !/^\d{2}:\d{2}(:\d{2})?$/.test(timeEntry.start_time)) {
    errors.push("start_time must be HH:mm or HH:mm:ss format");
  }
  if (timeEntry.end_time && !/^\d{2}:\d{2}(:\d{2})?$/.test(timeEntry.end_time)) {
    errors.push("end_time must be HH:mm or HH:mm:ss format");
  }

  // Validate hours
  if (timeEntry.normal_hours < 0) errors.push("normal_hours cannot be negative");
  if (timeEntry.extra_hours < 0) errors.push("extra_hours cannot be negative");

  return {
    valid: errors.length === 0,
    errors,
  };
}