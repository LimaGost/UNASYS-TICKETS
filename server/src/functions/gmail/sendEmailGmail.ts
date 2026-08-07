import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { gmailFetch, encodeHeader, encodeBase64UrlUnicode } from '../../integrations/gmail';
import type { Actor } from '../shared/actor';

async function fetchAttachment(url: string): Promise<{ base64: string; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch attachment: ${url}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return { base64, contentType };
}

export type SendEmailGmailInput = {
  ticket_id: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  attachments?: { url: string; name: string }[];
  email_record_id?: string;
  save_record?: { from_email: string; from_name: string };
};

/** Envio de e-mail a partir do composer de um ticket, com anexos e
 * encadeamento de thread (Reply/In-Reply-To) - a função mais usada pela UI. */
export async function sendEmailGmailCore(
  input: SendEmailGmailInput,
  actor: Actor & { email_signature?: string | null }
) {
  const { ticket_id, to, cc, bcc, subject, body, attachments = [], email_record_id, save_record } = input;
  if (!ticket_id || !to || !subject || !body) {
    throw Object.assign(new Error('Missing required fields'), { status: 400 });
  }

  const toArray = Array.isArray(to) ? to : [to];
  const ccArray = Array.isArray(cc) ? cc : cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const bccArray = Array.isArray(bcc) ? bcc : bcc ? bcc.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const senderName = (actor.name || 'Unasys Tickets').replace(/"/g, '');
  const senderEmail = env.gmail.senderEmail;

  const lastSentEmail = await prisma.ticketEmail.findFirst({
    where: { ticket_id, direction: 'sent' },
    orderBy: { created_date: 'desc' },
  });
  const existingThreadId = lastSentEmail?.gmail_thread_id || null;
  const replyToMessageId =
    lastSentEmail?.rfc_message_id ||
    (lastSentEmail?.gmail_message_id ? `<${lastSentEmail.gmail_message_id}@mail.gmail.com>` : null);

  const signature = actor.email_signature;
  const finalBody = signature
    ? `${body}<br><br><hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">${signature}`
    : body;

  const commonHeaders = [
    `To: ${toArray.join(', ')}`,
    ...(ccArray.length > 0 ? [`Cc: ${ccArray.join(', ')}`] : []),
    ...(bccArray.length > 0 ? [`Bcc: ${bccArray.join(', ')}`] : []),
    `From: ${encodeHeader(`"${senderName} - Unasys Tickets"`)} <${senderEmail}>`,
    `Reply-To: ${senderEmail}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    ...(replyToMessageId ? [`In-Reply-To: ${replyToMessageId}`] : []),
    ...(replyToMessageId ? [`References: ${replyToMessageId}`] : []),
  ];

  let encodedMessage: string;

  if (attachments.length === 0) {
    const messageLines = [...commonHeaders, 'Content-Type: text/html; charset=utf-8', '', finalBody];
    encodedMessage = encodeBase64UrlUnicode(messageLines.join('\r\n'));
  } else {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const attachmentParts = await Promise.all(
      attachments.map(async (att) => {
        const { base64, contentType } = await fetchAttachment(att.url);
        const safeName = encodeHeader(att.name);
        return [
          `--${boundary}`,
          `Content-Type: ${contentType}`,
          `Content-Disposition: attachment; filename="${safeName}"`,
          'Content-Transfer-Encoding: base64',
          '',
          base64,
        ].join('\r\n');
      })
    );

    const parts = [
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      finalBody,
      ...attachmentParts,
      `--${boundary}--`,
    ];

    const messageLines = [...commonHeaders, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ...parts];
    encodedMessage = encodeBase64UrlUnicode(messageLines.join('\r\n'));
  }

  const sendPayload: Record<string, unknown> = { raw: encodedMessage };
  if (existingThreadId) sendPayload.threadId = existingThreadId;

  const response = await gmailFetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sendPayload),
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({}));
    throw Object.assign(new Error(error.error?.message || 'Failed to send email'), { status: response.status });
  }

  const result: any = await response.json();
  const gmailMessageId = result.id;
  const gmailThreadId = result.threadId;

  let rfcMessageId: string | null = null;
  try {
    const msgDetailsRes = await gmailFetch(`/messages/${gmailMessageId}?format=metadata&metadataHeaders=Message-ID`);
    if (msgDetailsRes.ok) {
      const msgDetails: any = await msgDetailsRes.json();
      const msgIdHeader = msgDetails.payload?.headers?.find((h: any) => h.name === 'Message-ID');
      if (msgIdHeader) rfcMessageId = msgIdHeader.value;
    }
  } catch (e) {
    console.log('Não foi possível buscar Message-ID RFC:', (e as Error).message);
  }

  const attachmentRecords = attachments.map((a) => ({ file_url: a.url, file_name: a.name }));

  if (email_record_id) {
    await prisma.ticketEmail.update({
      where: { id: email_record_id },
      data: {
        gmail_message_id: gmailMessageId,
        gmail_thread_id: gmailThreadId,
        rfc_message_id: rfcMessageId || `<${gmailMessageId}@mail.gmail.com>`,
        attachments: attachmentRecords,
      },
    });
  } else if (save_record) {
    await prisma.ticketEmail.create({
      data: {
        ticket_id,
        direction: 'sent',
        from_email: save_record.from_email,
        from_name: save_record.from_name,
        to: toArray,
        cc: ccArray,
        bcc: bccArray,
        subject,
        body,
        attachments: attachmentRecords,
        gmail_message_id: gmailMessageId,
        gmail_thread_id: gmailThreadId,
        rfc_message_id: rfcMessageId || `<${gmailMessageId}@mail.gmail.com>`,
      },
    });
  }

  return { success: true, messageId: gmailMessageId, threadId: gmailThreadId };
}

export async function sendEmailGmailHandler(req: Request, res: Response) {
  try {
    const actor = {
      email: req.user!.email,
      name: req.user!.full_name || req.user!.email,
      email_signature: req.user!.email_signature,
    };
    const result = await sendEmailGmailCore(req.body ?? {}, actor);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
