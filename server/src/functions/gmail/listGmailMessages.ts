import type { Request, Response } from 'express';
import { gmailFetch } from '../../integrations/gmail';

/** Lista mensagens recentes da caixa de entrada (usado pela tela de
 * "converter e-mail em ticket" e pelo status de configuração de e-mail). */
export async function listGmailMessagesHandler(_req: Request, res: Response) {
  try {
    const listRes = await gmailFetch('/messages?q=newer_than:30d&maxResults=50');
    if (!listRes.ok) {
      const err = await listRes.text();
      return res.status(500).json({ error: 'Failed to fetch emails: ' + err });
    }
    const { messages = [] }: any = await listRes.json();

    const emailList = await Promise.all(
      messages.map(async (msg: { id: string }) => {
        const metaRes = await gmailFetch(
          `/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
        );
        if (!metaRes.ok) return null;
        const meta: any = await metaRes.json();
        const headers = meta.payload?.headers || [];
        return {
          id: msg.id,
          subject: headers.find((h: any) => h.name === 'Subject')?.value || '(sem assunto)',
          from: headers.find((h: any) => h.name === 'From')?.value || '',
          date: headers.find((h: any) => h.name === 'Date')?.value || '',
          snippet: meta.snippet || '',
        };
      })
    );

    return res.json({ success: true, emails: emailList.filter(Boolean) });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
