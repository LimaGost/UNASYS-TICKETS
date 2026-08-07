import { prisma } from '../../db/prisma';
import { createNotificationCore } from '../notifications/createNotification';
import type { Ticket } from '@prisma/client';

const URGENCY_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: '🚨 CRÍTICA' };

/** Disparado depois que um Ticket é criado (hook automático de criação).
 * Nota: a numeração sequencial do ticket_number que versões anteriores
 * faziam manualmente não é mais necessária - o Postgres atribui isso
 * nativamente (`ticket_number` é uma coluna auto-increment). */
export async function onTicketCreatedHook(ticket: Ticket) {
  if (ticket.vertical) {
    const analistas = await prisma.user.findMany({
      where: { tipo_perfil: 'interno', vertical: ticket.vertical },
    });

    const tipoLabel = ticket.main_type === 'implantacao' ? 'Implantação' : 'Suporte';
    const urgLabel = URGENCY_LABEL[ticket.urgency] || ticket.urgency;

    for (const analista of analistas) {
      await createNotificationCore({
        user_email: analista.email,
        type: 'ticket_created',
        title: `Novo ticket de ${tipoLabel}`,
        message: `"${ticket.title}" | Cliente: ${ticket.client_name || '—'} | Urgência: ${urgLabel}`,
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        priority: ticket.urgency === 'critica' || ticket.urgency === 'alta' ? 'high' : 'normal',
        actor_name: ticket.client_name || 'Cliente',
      });
    }
  }

  // Só cria ClienteImplantacao para tickets de implantação (não suporte)
  if (ticket.main_type !== 'implantacao') return;
  if (!ticket.client_id || !ticket.client_name) return;

  const existing = await prisma.clienteImplantacao.findFirst({
    where: { usuario_email: ticket.client_email ?? undefined },
  });
  if (existing) return;

  await prisma.clienteImplantacao.create({
    data: {
      nome_empresa: ticket.client_name,
      usuario_email: ticket.client_email || '',
      analista_responsavel: ticket.assigned_to_name || '',
      analista_email: ticket.assigned_to || '',
      status_geral: 'em_andamento',
      progresso_percentual: 0,
      cadastro_enviado: false,
      observacoes_analista: `Criado automaticamente a partir do ticket: ${ticket.title}`,
      vertical: ticket.vertical,
    },
  });
}
