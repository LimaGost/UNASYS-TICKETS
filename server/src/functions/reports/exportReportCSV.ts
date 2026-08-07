import type { Request, Response } from 'express';

type ReportTicket = {
  id: string;
  title: string;
  client_name?: string;
  requester?: string;
  vertical?: string;
  ticket_type?: string;
  service_type?: string;
  category?: string;
  urgency?: string;
  status_column_title?: string;
  assigned_to_name?: string;
  created_date?: string;
  closed_at?: string;
  sla_hours?: number;
  sla_breached?: boolean;
  total_normal_hours?: number;
  total_extra_hours?: number;
  description?: string;
};

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportReportCSVHandler(req: Request, res: Response) {
  try {
    const { tickets } = (req.body ?? {}) as { tickets: ReportTicket[] };
    if (!tickets || tickets.length === 0) {
      return res.status(400).json({ error: 'Nenhum ticket para exportar' });
    }

    const headers = [
      'ID', 'Título', 'Cliente', 'Solicitante', 'Vertical', 'Tipo de Ticket', 'Tipo de Serviço',
      'Categoria', 'Urgência', 'Status', 'Responsável', 'Data de Criação', 'Data de Resolução',
      'SLA (horas)', 'SLA Estourado', 'Horas Normais', 'Horas Extras', 'Total de Horas', 'Descrição',
    ];

    const rows = tickets.map((t) => [
      escapeCSV(t.id.slice(0, 8)),
      escapeCSV(t.title),
      escapeCSV(t.client_name),
      escapeCSV(t.requester),
      escapeCSV(t.vertical),
      escapeCSV(t.ticket_type),
      escapeCSV(t.service_type),
      escapeCSV(t.category),
      escapeCSV(t.urgency),
      escapeCSV(t.status_column_title),
      escapeCSV(t.assigned_to_name),
      escapeCSV(t.created_date ? new Date(t.created_date).toLocaleDateString('pt-BR') : ''),
      escapeCSV(t.closed_at ? new Date(t.closed_at).toLocaleDateString('pt-BR') : ''),
      escapeCSV(t.sla_hours),
      escapeCSV(t.sla_breached ? 'Sim' : 'Não'),
      escapeCSV(t.total_normal_hours || 0),
      escapeCSV(t.total_extra_hours || 0),
      escapeCSV((t.total_normal_hours || 0) + (t.total_extra_hours || 0)),
      escapeCSV(t.description),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const csvWithBom = '﻿' + csvContent;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-tickets-${Date.now()}.csv`);
    return res.send(csvWithBom);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
