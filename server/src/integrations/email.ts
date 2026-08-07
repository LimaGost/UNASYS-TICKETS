import { gmailConfigured, gmailFetch, encodeHeader, encodeBase64UrlUnicode } from './gmail';

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

/** Envio de e-mail simples via Gmail (conta corporativa), usado por
 * automações e pela notificação "aguardando retorno" do updateTicketStatus.
 * Se o Gmail ainda não estiver configurado, registra no log em vez de
 * quebrar o fluxo que chamou (comportamento "best effort" intencional:
 * envio de e-mail nunca deve bloquear a ação principal). */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!input.to) return;

  if (!gmailConfigured()) {
    console.warn(
      `[email] Gmail não configurado - e-mail não enviado. Destinatário: ${input.to}, assunto: "${input.subject}"`
    );
    return;
  }

  const messageLines = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    input.body,
  ];
  const raw = encodeBase64UrlUnicode(messageLines.join('\r\n'));

  const res = await gmailFetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail via Gmail: ${res.status} ${errText}`);
  }
}
