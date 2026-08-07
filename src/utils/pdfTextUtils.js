// Utilitários para preparar texto (HTML rico, caracteres especiais) para renderização no jsPDF

const HTML_ENTITIES = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&atilde;": "ã", "&otilde;": "õ", "&ccedil;": "ç", "&acirc;": "â", "&ecirc;": "ê", "&ocirc;": "ô",
  "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&Atilde;": "Ã", "&Otilde;": "Õ", "&Ccedil;": "Ç", "&Acirc;": "Â", "&Ecirc;": "Ê", "&Ocirc;": "Ô",
};

// Converte HTML (ex: descrição de atividade vinda do editor rico) em texto puro, preservando quebras de linha
export function htmlToPlainText(html) {
  if (!html) return "";
  let text = String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");

  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  Object.entries(HTML_ENTITIES).forEach(([entity, char]) => {
    text = text.split(entity).join(char);
  });

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// Substitui/remove caracteres Unicode que a fonte padrão do jsPDF não sabe renderizar
// (emojis, ícones, setas), evitando o efeito de "texto quebrado"
export function sanitizeForPdf(text) {
  if (!text) return "";
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emojis e dingbats
    .replace(/●/g, "•")
    .replace(/○/g, "o")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/✓|✔/g, "[OK]")
    .replace(/⚠/g, "[!]")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // caracteres de controle
    .trim();
}

// Atalho: HTML -> texto puro -> sanitizado, pronto para doc.text()/splitTextToSize()
export function cleanTextForPdf(html) {
  return sanitizeForPdf(htmlToPlainText(html));
}