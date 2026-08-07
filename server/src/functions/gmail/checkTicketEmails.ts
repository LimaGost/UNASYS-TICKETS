import type { Request, Response } from 'express';
import type { TicketEmail } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { gmailFetch, getGmailAccessToken, decodeMimeHeader, fixMojibake, extractBody } from '../../integrations/gmail';
import { createNotificationCore } from '../notifications/createNotification';

type EmailIndex = {
  byThread: Map<string, TicketEmail[]>;
  byMsgId: Map<string, TicketEmail>;
  byRfc: Map<string, TicketEmail>;
  byTicket: Map<string, TicketEmail[]>;
};

// Carrega todos os TicketEmails uma vez e monta índices em memória (evita rate limit)
async function loadEmailIndex(): Promise<EmailIndex> {
  const all = await prisma.ticketEmail.findMany({ orderBy: { created_date: 'desc' }, take: 3000 });
  const byThread = new Map<string, TicketEmail[]>();
  const byMsgId = new Map<string, TicketEmail>();
  const byRfc = new Map<string, TicketEmail>();
  const byTicket = new Map<string, TicketEmail[]>();
  for (const e of all) {
    if (e.gmail_thread_id) {
      if (!byThread.has(e.gmail_thread_id)) byThread.set(e.gmail_thread_id, []);
      byThread.get(e.gmail_thread_id)!.push(e);
    }
    if (e.gmail_message_id) byMsgId.set(e.gmail_message_id, e);
    if (e.rfc_message_id) byRfc.set(e.rfc_message_id, e);
    if (!byTicket.has(e.ticket_id)) byTicket.set(e.ticket_id, []);
    byTicket.get(e.ticket_id)!.push(e);
  }
  return { byThread, byMsgId, byRfc, byTicket };
}

async function fixThreadIds(index: EmailIndex, ticketId: string, threadId: string) {
  const emails = index.byTicket.get(ticketId) || [];
  for (const te of emails) {
    if (!te.gmail_thread_id || te.gmail_thread_id !== threadId) {
      await prisma.ticketEmail.update({ where: { id: te.id }, data: { gmail_thread_id: threadId } });
      te.gmail_thread_id = threadId;
    }
  }
}

async function resolveTicketId(
  index: EmailIndex,
  threadId: string,
  subject: string
): Promise<{ ticketId: string; emailRecord: TicketEmail | null } | null> {
  const byThread = index.byThread.get(threadId);
  if (byThread && byThread.length > 0) {
    const latest = [...byThread].sort((a, b) => b.created_date.getTime() - a.created_date.getTime())[0];
    return { ticketId: latest.ticket_id, emailRecord: latest };
  }

  const byMsgId = index.byMsgId.get(threadId);
  if (byMsgId) {
    await fixThreadIds(index, byMsgId.ticket_id, threadId);
    return { ticketId: byMsgId.ticket_id, emailRecord: byMsgId };
  }

  try {
    const threadRes = await gmailFetch(`/threads/${threadId}?format=metadata&metadataHeaders=Message-ID`);
    if (threadRes.ok) {
      const threadData: any = await threadRes.json();
      for (const tm of threadData.messages || []) {
        const rfcMsgId = tm.payload?.headers?.find((h: any) => h.name === 'Message-ID')?.value;
        if (!rfcMsgId) continue;
        const byRfc = index.byRfc.get(rfcMsgId);
        if (byRfc) {
          await fixThreadIds(index, byRfc.ticket_id, threadId);
          return { ticketId: byRfc.ticket_id, emailRecord: byRfc };
        }
        const shortId = rfcMsgId.replace(/^<|>$/g, '').split('@')[0];
        const byShort = shortId ? index.byMsgId.get(shortId) : null;
        if (byShort) {
          await fixThreadIds(index, byShort.ticket_id, threadId);
          return { ticketId: byShort.ticket_id, emailRecord: byShort };
        }
      }
    }
  } catch (e) {
    console.log('Erro ao buscar thread no Gmail:', (e as Error).message);
  }

  const matchTicket = subject.match(/#\s*(\d+)/);
  if (matchTicket) {
    const ticket = await prisma.ticket.findUnique({ where: { ticket_number: parseInt(matchTicket[1], 10) } });
    if (ticket) return { ticketId: ticket.id, emailRecord: null };
  }

  const matchOP = subject.match(/OP[:\s]+([0-9.]+)/i);
  if (matchOP) {
    const opNumber = matchOP[1].replace(/\./g, '');
    const ticket = await prisma.ticket.findFirst({ where: { external_order_number: opNumber } });
    if (ticket) return { ticketId: ticket.id, emailRecord: null };
  }

  return null;
}

/** Verifica respostas novas na caixa de entrada e registra no ticket
 * correspondente (resolvido por thread/Message-ID/nº do ticket/nº da OP).
 * Consolida o que antes eram várias funções semelhantes (checkTicketEmails,
 * processEmailResponses, checkIncomingEmails) numa só. Chamada pelo cron
 * (polling) e também pela tela do ticket ("verificar respostas agora"). */
export async function checkTicketEmailsCore(filterTicketId?: string | null) {
  await getGmailAccessToken(); // valida cedo que o Gmail está configurado

  const index = await loadEmailIndex();

  let knownThreadIds: Set<string> | null = null;
  if (filterTicketId) {
    const ticketEmails = index.byTicket.get(filterTicketId) || [];
    const threadSet = new Set(ticketEmails.map((e) => e.gmail_thread_id).filter(Boolean) as string[]);
    const msgIdSet = new Set(ticketEmails.map((e) => e.gmail_message_id).filter(Boolean) as string[]);
    knownThreadIds = new Set([...threadSet, ...msgIdSet]);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const afterDate = sevenDaysAgo.toISOString().split('T')[0];
  const query = `after:${afterDate} -from:projetos@unasyshub.com.br`;

  const listResponse = await gmailFetch(`/messages?q=${encodeURIComponent(query)}&maxResults=100`);
  if (!listResponse.ok) {
    throw Object.assign(new Error('Failed to fetch emails'), { status: listResponse.status });
  }

  const listData: any = await listResponse.json();
  const messages: { id: string }[] = listData.messages || [];
  const processedEmails: { messageId: string; ticketId: string; subject: string; from: string }[] = [];

  for (const msg of messages) {
    if (index.byMsgId.has(msg.id)) continue;

    const msgResponse = await gmailFetch(`/messages/${msg.id}`);
    if (!msgResponse.ok) continue;
    const msgData: any = await msgResponse.json();
    const headers: { name: string; value: string }[] = msgData.payload?.headers || [];
    const labelIds: string[] = msgData.labelIds || [];

    if (labelIds.includes('SENT')) continue;

    const subject = fixMojibake(decodeMimeHeader(headers.find((h) => h.name === 'Subject')?.value || ''));
    const from = fixMojibake(decodeMimeHeader(headers.find((h) => h.name === 'From')?.value || ''));
    const fromEmailMatch = from.match(/<(.+?)>/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from.trim();
    const fromName = from.includes('<') ? from.split('<')[0].trim().replace(/"/g, '') : fromEmail;
    const threadId = msgData.threadId;

    if (filterTicketId && knownThreadIds && knownThreadIds.size > 0 && !knownThreadIds.has(threadId)) continue;

    const resolved = await resolveTicketId(index, threadId, subject);
    if (!resolved) {
      console.log(`E-mail não associado a nenhum ticket: ${subject} (thread: ${threadId})`);
      continue;
    }
    const { ticketId, emailRecord } = resolved;
    if (filterTicketId && ticketId !== filterTicketId) continue;

    const emailBody = fixMojibake(extractBody(msgData.payload));

    const createdEmail = await prisma.ticketEmail.create({
      data: {
        ticket_id: ticketId,
        subject,
        body: emailBody,
        from_email: fromEmail,
        from_name: fromName,
        to: [],
        cc: [],
        direction: 'received',
        gmail_message_id: msg.id,
        gmail_thread_id: threadId,
        reply_to_email_id: emailRecord?.id || '',
        is_reply: true,
        visible_to_client: true,
      },
    });
    index.byMsgId.set(msg.id, createdEmail);

    await prisma.ticketEvent.create({
      data: {
        ticket_id: ticketId,
        type: 'comment_client',
        description: `Resposta recebida de ${fromName} <${fromEmail}>: "${subject}"`,
        user_email: fromEmail,
        user_name: fromName,
        visible_to_client: true,
      },
    });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (ticket?.assigned_to) {
      await createNotificationCore({
        user_email: ticket.assigned_to,
        type: 'new_comment',
        title: '📧 Resposta de e-mail recebida',
        message: `"${fromName || fromEmail}" respondeu o ticket "${ticket.title}": ${subject}`,
        ticket_id: ticketId,
        ticket_title: ticket.title,
        priority: 'normal',
        actor_name: fromName || fromEmail,
        actor_email: fromEmail,
      });
    }

    await gmailFetch(`/messages/${msg.id}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });

    console.log(`Resposta registrada no ticket ${ticketId} (thread: ${threadId})`);
    processedEmails.push({ messageId: msg.id, ticketId, subject, from: fromEmail });
  }

  return { success: true, processed: processedEmails.length, emails: processedEmails };
}

export async function checkTicketEmailsHandler(req: Request, res: Response) {
  try {
    const result = await checkTicketEmailsCore(req.body?.ticketId ?? null);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
