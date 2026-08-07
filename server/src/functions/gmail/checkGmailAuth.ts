import type { Request, Response } from 'express';
import { getGmailAccessToken, gmailConfigured } from '../../integrations/gmail';

export async function checkGmailAuthHandler(_req: Request, res: Response) {
  if (!gmailConfigured()) {
    return res.json({ authorized: false });
  }
  try {
    await getGmailAccessToken();
    return res.json({ authorized: true });
  } catch {
    return res.json({ authorized: false });
  }
}
