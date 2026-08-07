import type { Request, Response } from 'express';
import { gmailFetch, encodeBase64UrlUnicode } from '../../integrations/gmail';

/** Envio de teste simples, usado pela tela de status de configuração de e-mail. */
export async function testEmailSendHandler(req: Request, res: Response) {
  try {
    const { to, subject, body } = req.body ?? {};
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const messageLines = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/html; charset=utf-8', 'MIME-Version: 1.0', '', body];
    const raw = encodeBase64UrlUnicode(messageLines.join('\r\n'));

    const response = await gmailFetch('/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: error.error?.message || 'Failed to send email' });
    }

    const result: any = await response.json();
    return res.json({ success: true, messageId: result.id });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
