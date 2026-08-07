import type { Request, Response } from 'express';
import { METABOT_BASE_URL, metabotHeaders } from '../../integrations/metabot';

/** Proxy genérico para a API do Metabot (WhatsApp) - espelha as várias
 * "actions" que o front chama através de src/lib/metabotAPI.js:
 * list, chat, send, send-media, send-contacts, send-action-card,
 * get-message, create-chat, close-chat, update-chat, test. */
export async function fetchMetabotChatsHandler(req: Request, res: Response) {
  let headers: Record<string, string>;
  try {
    headers = metabotHeaders();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  const reqBody = req.body ?? {};
  const { action = 'list', chat_id } = reqBody;

  try {
    if (action === 'list') {
      const statuses = [
        { status: 0, name: 'automatico' },
        { status: 1, name: 'aguardando' },
        { status: 2, name: 'manual' },
        { status: 5, name: 'fora_de_hora' },
        { status: 6, name: 'grupo' },
      ];

      const responses = await Promise.all(
        statuses.map((s) =>
          fetch(`${METABOT_BASE_URL}/chats/list`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ status: s.status, typeChat: 2, page: 0 }),
          })
        )
      );
      const datas: any[] = await Promise.all(responses.map((r) => r.json().catch(() => ({}))));

      const addStatus = (chats: any[], statusName: string) => (chats || []).map((c) => ({ ...c, _metabotStatus: statusName }));

      const allChats = statuses.flatMap((s, i) => addStatus(datas[i]?.chats, s.name));

      const flows: Record<string, { count: number; chats: any[] }> = {};
      statuses.forEach((s, i) => {
        flows[s.name] = { count: datas[i]?.totalAmountChats || 0, chats: datas[i]?.chats || [] };
      });

      return res.json({
        success: true,
        chats: allChats,
        flows,
        total: statuses.reduce((sum, _s, i) => sum + (datas[i]?.totalAmountChats || 0), 0),
      });
    }

    if (action === 'chat' && chat_id) {
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}`, { headers });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'send' && chat_id) {
      const { message } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, forceSend: false, isWhisper: false, verifyContact: false }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'send-media' && chat_id) {
      const { mediaUrl, caption, mediaType } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}/send-media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mediaUrl, caption: caption || '', mediaType: mediaType || 'image' }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'send-contacts' && chat_id) {
      const { contacts } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}/send-contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contacts: contacts || [] }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'send-action-card' && chat_id) {
      const { title, body, buttons } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}/send-action-card`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: title || '', body: body || '', buttons: buttons || [] }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'get-message' && chat_id) {
      const { messageId } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/messages/${messageId}`, { headers });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'create-chat') {
      const { contactNumber, name, description } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/create-new`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contactNumber: contactNumber || '', name: name || '', description: description || '' }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'close-chat' && chat_id) {
      const { reason } = reqBody;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'closed', reason: reason || 'Closed by system' }),
      });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'update-chat' && chat_id) {
      const { status, assignedTo, notes } = reqBody;
      const updateBody: Record<string, unknown> = {};
      if (status) updateBody.status = status;
      if (assignedTo) updateBody.assignedTo = assignedTo;
      if (notes) updateBody.notes = notes;
      const r = await fetch(`${METABOT_BASE_URL}/chats/${chat_id}`, { method: 'PUT', headers, body: JSON.stringify(updateBody) });
      const data = await r.json().catch(() => ({}));
      return res.json({ success: r.ok, status: r.status, data });
    }

    if (action === 'test') {
      const r = await fetch(`${METABOT_BASE_URL}/channel`, { headers });
      const data = await r.json().catch(() => ({}));
      return res.json({ status: r.status, data });
    }

    return res.status(400).json({
      error: 'action inválida. Use: list, chat, send, send-media, send-contacts, send-action-card, get-message, create-chat, close-chat, update-chat, test',
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
