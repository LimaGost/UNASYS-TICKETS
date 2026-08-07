import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { runAfterCreate } from '../../entities/hooks';

/** Webhook chamado pelo Metabot quando há eventos de chat do WhatsApp -
 * cria ou atualiza um ticket de suporte automaticamente. Protegido pelo
 * mesmo token de webhook usado pelas integrações do CRM (configure esse
 * valor também no painel do Metabot ao cadastrar a URL do webhook). */
export async function metabotWebhookHandler(req: Request, res: Response) {
  const body = req.body ?? {};

  const event = body?.event || body?.type || body?.eventType;
  const chatData = body?.data || body?.chat || body;

  const contactName = chatData?.contact?.name || chatData?.contactName || chatData?.name || 'Contato WhatsApp';
  const contactNumber = chatData?.contact?.number || chatData?.number || chatData?.phone || '';
  const message = chatData?.lastMessage?.text || chatData?.message || chatData?.text || '';
  const chatId = chatData?.id || chatData?.chatId || body?.chatId;
  const sectorName = chatData?.sector?.name || chatData?.sectorName || '';
  const attendantName = chatData?.attendant?.name || chatData?.userName || '';

  const title = `WhatsApp - ${contactName}${contactNumber ? ' (' + contactNumber + ')' : ''}`;

  let existingTicket = null;
  if (chatId) {
    existingTicket = await prisma.ticket.findFirst({ where: { external_reference: String(chatId) } });
  }

  if (existingTicket) {
    await prisma.ticketEvent.create({
      data: {
        ticket_id: existingTicket.id,
        type: 'comment_client',
        description: message ? `Nova mensagem do WhatsApp: ${message}` : `Novo evento Metabot: ${event || 'atualização'}`,
        user_email: contactNumber ? `${contactNumber}@whatsapp` : 'whatsapp@metabot',
        user_name: contactName,
        visible_to_client: false,
      },
    });
    return res.json({ success: true, action: 'updated', ticket_id: existingTicket.id });
  }

  let clientId: string | null = null;
  let clientName = contactName;
  let clientEmail = contactNumber ? `${contactNumber}@whatsapp.com` : 'whatsapp@sem-email.com';

  if (contactNumber) {
    const digits = String(contactNumber).replace(/\D/g, '');
    const clients = await prisma.client.findMany();
    const matchedClient = clients.find((c) => c.phone && c.phone.replace(/\D/g, '').includes(digits));
    if (matchedClient) {
      clientId = matchedClient.id;
      clientName = matchedClient.name || matchedClient.nome_fantasia || contactName;
      clientEmail = matchedClient.email || clientEmail;
    }
  }

  const verticals = await prisma.vertical.findMany();
  const firstVertical = verticals[0]?.code || 'default';

  if (!clientId) {
    const newClient = await prisma.client.create({
      data: {
        name: contactName,
        nome_fantasia: contactName,
        email: clientEmail,
        phone: contactNumber,
        vertical: firstVertical,
        notes: 'Criado automaticamente via Metabot/WhatsApp',
      },
    });
    clientId = newClient.id;
    clientName = newClient.name || contactName;
  }

  const kanbanConfigs = await prisma.kanbanConfig.findMany({ where: { main_type: 'suporte' } });
  const kanbanConfig = kanbanConfigs.find((k) => k.vertical === firstVertical) || kanbanConfigs[0];
  const columns = (kanbanConfig?.columns as { title: string; order?: number }[]) || [];
  const firstColumn = columns.length > 0 ? [...columns].sort((a, b) => (a.order || 0) - (b.order || 0))[0] : null;

  const newTicket = await prisma.ticket.create({
    data: {
      title,
      main_type: 'suporte',
      client_id: clientId,
      client_name: clientName,
      client_email: clientEmail,
      vertical: firstVertical,
      ticket_type: 'Suporte',
      requester: contactName,
      urgency: 'media',
      description: message ? `Mensagem inicial: ${message}` : 'Atendimento iniciado via WhatsApp',
      status_column_id: firstColumn?.title || 'Novo',
      status_column_title: firstColumn?.title || 'Novo',
      external_reference: String(chatId || ''),
      external_system: 'Metabot',
      external_customer_code: contactNumber,
      notified: false,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      ticket_id: newTicket.id,
      type: 'creation',
      description: `Ticket criado automaticamente via Metabot/WhatsApp${sectorName ? ' - Setor: ' + sectorName : ''}${attendantName ? ' - Atendente: ' + attendantName : ''}`,
      user_email: 'metabot@sistema',
      user_name: 'Metabot',
      visible_to_client: false,
    },
  });

  await runAfterCreate('Ticket', newTicket);

  return res.json({ success: true, action: 'created', ticket_id: newTicket.id });
}
