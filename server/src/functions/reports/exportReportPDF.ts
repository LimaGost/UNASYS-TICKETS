import type { Request, Response } from 'express';
import { jsPDF } from 'jspdf';

type ReportTicket = {
  id: string;
  title: string;
  client_name?: string;
  status_column_title?: string;
  urgency?: string;
};

export async function exportReportPDFHandler(req: Request, res: Response) {
  try {
    const { tickets, kpis, filters } = (req.body ?? {}) as {
      tickets?: ReportTicket[];
      kpis?: Record<string, string | number>;
      filters?: { startDate?: string; endDate?: string; vertical?: string; client?: string; assigned?: string };
    };

    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(139, 92, 246);
    doc.text('Relatório de Tickets', 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, y);
    y += 5;
    doc.text(`Por: ${req.user!.full_name || req.user!.email}`, 20, y);
    y += 10;

    if (filters) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Filtros Aplicados:', 20, y);
      y += 7;

      doc.setFontSize(9);
      doc.setTextColor(80);
      if (filters.startDate && filters.endDate) {
        doc.text(`Período: ${filters.startDate} até ${filters.endDate}`, 25, y);
        y += 5;
      }
      if (filters.vertical) {
        doc.text(`Vertical: ${filters.vertical}`, 25, y);
        y += 5;
      }
      if (filters.client) {
        doc.text(`Cliente: ${filters.client}`, 25, y);
        y += 5;
      }
      if (filters.assigned) {
        doc.text(`Responsável: ${filters.assigned}`, 25, y);
        y += 5;
      }
      y += 5;
    }

    if (kpis) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Indicadores Chave (KPIs)', 20, y);
      y += 8;

      doc.setFontSize(10);
      const kpiData: [string, string][] = [
        ['Total de Tickets', String(kpis.totalTickets ?? '0')],
        ['Tickets Abertos', String(kpis.openTickets ?? '0')],
        ['Tickets Resolvidos', String(kpis.resolvedTickets ?? '0')],
        ['Taxa de Resolução', String(kpis.resolutionRate ?? '0%')],
        ['Tickets Atrasados', String(kpis.overdueTickets ?? '0')],
        ['Horas Normais', String(kpis.normalHours ?? '0h')],
        ['Horas Extras', String(kpis.extraHours ?? '0h')],
        ['Tempo Médio Resolução', String(kpis.avgResolutionTime ?? '0h')],
      ];

      kpiData.forEach(([label, value]) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(100);
        doc.text(label + ':', 25, y);
        doc.setTextColor(139, 92, 246);
        doc.text(value, 120, y);
        y += 6;
      });
      y += 5;
    }

    if (tickets && tickets.length > 0) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Detalhes dos Tickets', 20, y);
      y += 8;

      doc.setFontSize(8);
      doc.setTextColor(100);

      doc.text('ID', 20, y);
      doc.text('Título', 45, y);
      doc.text('Cliente', 110, y);
      doc.text('Status', 150, y);
      doc.text('Urgência', 175, y);
      y += 5;

      doc.setDrawColor(139, 92, 246);
      doc.line(20, y, 190, y);
      y += 5;

      tickets.slice(0, 50).forEach((ticket) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        doc.setTextColor(80);
        doc.text(ticket.id.slice(0, 8), 20, y);
        doc.text((ticket.title || '').slice(0, 25), 45, y);
        doc.text((ticket.client_name || '').slice(0, 20), 110, y);
        doc.text((ticket.status_column_title || '').slice(0, 12), 150, y);
        doc.text(ticket.urgency || '', 175, y);
        y += 5;
      });

      if (tickets.length > 50) {
        y += 3;
        doc.setTextColor(100);
        doc.text(`... e mais ${tickets.length - 50} tickets`, 20, y);
      }
    }

    // Os typings do jsPDF não declaram getNumberOfPages em `internal`,
    // embora exista em runtime.
    const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 20, 290);
      doc.text('Unasys Tickets - Sistema de Gestão de Tickets', 105, 290, { align: 'center' });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-tickets-${Date.now()}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF export error:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
