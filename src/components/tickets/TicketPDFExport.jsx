import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
import { cleanTextForPdf } from "@/utils/pdfTextUtils";

const TZ = "America/Sao_Paulo";

function fmtDate(d) {
  if (!d) return "—";
  try { return tzFormat(toZonedTime(new Date(d), TZ), "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ }); }
  catch { return "—"; }
}

function fmtDateShort(d) {
  if (!d) return "—";
  try { return tzFormat(toZonedTime(new Date(d), TZ), "dd/MM/yyyy", { timeZone: TZ }); }
  catch { return "—"; }
}

// Formata a DATA DO APONTAMENTO (TimeEntry.date, ex: "2026-08-04") sem conversão
// de fuso horário — já é uma data "pura" (sem hora), e passar por fmtDateShort
// (que assume UTC e converte p/ America/Sao_Paulo) pode voltar 1 dia por causa
// do fuso. NÃO usar created_date aqui: o analista pode lançar hoje um registro
// referente a um dia anterior, e o PDF (enviado ao cliente) precisa refletir o
// dia efetivamente trabalhado.
function fmtEntryDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = String(dateStr).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  } catch { return "—"; }
}

const URGENCY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const SERVICE_MODE_LABELS = { reativo: "Reativo", proativo: "Proativo", continuo: "Contínuo" };

export default function TicketPDFExport({ ticket, timeEntries = [], ticketNumber, events = [], emails = [] }) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!ticket) return;
    setLoading(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const marginL = 15;
      const marginR = 15;
      const contentW = pageW - marginL - marginR;
      let y = 0;

      const checkPage = (needed = 10) => {
        if (y + needed > pageH - 15) {
          doc.addPage();
          y = 15;
        }
      };

      // ── Header bar ──
      doc.setFillColor(88, 28, 235); // primary purple
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Ticket", marginL, 12);

      const ticketLabel = ticketNumber
        ? `#${String(ticketNumber).padStart(4, "0")}`
        : `#${ticket.id?.slice(0, 8) || "—"}`;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(ticketLabel, marginL, 20);

      // date top right
      doc.setFontSize(8);
      const now = fmtDate(new Date().toISOString());
      doc.text(`Gerado em: ${now}`, pageW - marginR, 20, { align: "right" });

      y = 36;
      doc.setTextColor(30, 30, 40);

      // ── Title ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(ticket.title || "Sem título", contentW);
      doc.text(titleLines, marginL, y);
      y += titleLines.length * 7 + 4;

      // Status badge inline
      const statusText = ticket.status_column_title || "—";
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(88, 28, 235);
      doc.text(`• ${statusText}`, marginL, y);
      y += 8;

      // ── Divider ──
      doc.setDrawColor(220, 220, 230);
      doc.line(marginL, y, pageW - marginR, y);
      y += 6;

      // ── Helper: section title ──
      const sectionTitle = (title) => {
        checkPage(12);
        doc.setFillColor(245, 243, 255);
        doc.rect(marginL, y - 3, contentW, 8, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(88, 28, 235);
        doc.text(title.toUpperCase(), marginL + 2, y + 2.5);
        y += 8;
        doc.setTextColor(30, 30, 40);
      };

      // ── Helper: row ──
      const row = (label, value, x1 = marginL, colW = contentW) => {
        checkPage(7);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 120);
        doc.text(label, x1, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 40);
        const val = String(value || "—");
        const lines = doc.splitTextToSize(val, colW - 30);
        doc.text(lines, x1 + 28, y);
        y += lines.length * 5 + 2;
      };

      // ── Informações do Cliente ──
      sectionTitle("Informações do Cliente");
      const half = contentW / 2 - 3;
      const col2x = marginL + contentW / 2 + 3;

      // two-column rows
      const twoCol = (l1, v1, l2, v2) => {
        checkPage(7);
        const startY = y;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 120);
        doc.text(l1, marginL, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 40);
        const lines1 = doc.splitTextToSize(String(v1 || "—"), half - 28);
        doc.text(lines1, marginL + 28, y);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 120);
        doc.text(l2, col2x, startY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 40);
        const lines2 = doc.splitTextToSize(String(v2 || "—"), half - 28);
        doc.text(lines2, col2x + 28, startY);

        y += Math.max(lines1.length, lines2.length) * 5 + 2;
      };

      twoCol("Cliente", ticket.client_name, "E-mail", ticket.client_email);
      twoCol("Solicitante", ticket.requester, "Analista", ticket.assigned_to_name);

      y += 3;

      // ── Classificação ──
      sectionTitle("Classificação");
      twoCol("Tipo Principal", ticket.main_type === "chamado" ? "Chamado" : "Suporte", "Tipo de Ticket", ticket.ticket_type);
      twoCol("Urgência", URGENCY_LABELS[ticket.urgency] || ticket.urgency, "Modo", SERVICE_MODE_LABELS[ticket.service_mode] || ticket.service_mode);
      twoCol("Categoria", ticket.category, "Serviço", ticket.service_type);
      twoCol("Vertical", ticket.vertical, "Status", ticket.status_column_title);
      if (ticket.sub_status) row("Sub-status", ticket.sub_status);

      y += 3;

      // ── Datas ──
      sectionTitle("Datas");
      twoCol("Criado em", fmtDate(ticket.created_date), "Previsto", fmtDate(ticket.expected_resolution));
      if (ticket.closed_at) row("Encerrado em", fmtDate(ticket.closed_at));

      y += 3;

      // ── Resumo de Horas ──
      const totalNormal = timeEntries.reduce((s, e) => s + (e.normal_hours || 0), 0) || ticket.total_normal_hours || 0;
      const totalExtra = timeEntries.reduce((s, e) => s + (e.extra_hours || 0), 0) || ticket.total_extra_hours || 0;
      const totalUsed = totalNormal + totalExtra;

      sectionTitle("Resumo de Horas");
      twoCol("Horas Normais", `${totalNormal.toFixed(2)}h`, "Horas Extras", `${totalExtra.toFixed(2)}h`);
      twoCol("Total Utilizado", `${totalUsed.toFixed(2)}h`, "Horas Contratadas", ticket.contracted_hours ? `${ticket.contracted_hours}h` : "—");

      if (ticket.contracted_hours > 0) {
        const pct = Math.min((totalUsed / ticket.contracted_hours) * 100, 100);
        const remaining = Math.max(ticket.contracted_hours - totalUsed, 0);
        const isOver = totalUsed > ticket.contracted_hours;
        twoCol(
          "% Utilizado", `${pct.toFixed(1)}%`,
          isOver ? "Excedente" : "Restante",
          isOver ? `${(totalUsed - ticket.contracted_hours).toFixed(2)}h` : `${remaining.toFixed(2)}h`
        );

        // Progress bar
        checkPage(12);
        y += 2;
        doc.setFillColor(230, 230, 240);
        doc.roundedRect(marginL, y, contentW, 5, 2, 2, "F");
        const barColor = isOver ? [239, 68, 68] : pct > 80 ? [249, 115, 22] : pct > 50 ? [234, 179, 8] : [16, 185, 129];
        doc.setFillColor(...barColor);
        doc.roundedRect(marginL, y, (contentW * pct) / 100, 5, 2, 2, "F");
        y += 10;
      }

      y += 3;

      // ── Descrição ──
      if (ticket.description) {
        sectionTitle("Descrição");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 60);
        const descLines = doc.splitTextToSize(cleanTextForPdf(ticket.description), contentW - 4);
        descLines.forEach((line) => {
          checkPage(6);
          doc.text(line, marginL + 2, y);
          y += 5;
        });
        y += 3;
      }

      // ── Dados Externos ──
      if (ticket.external_order_number || ticket.external_reference || ticket.external_customer_code) {
        sectionTitle("Dados Externos");
        if (ticket.external_order_number) row("Nº OP / Pedido", ticket.external_order_number);
        if (ticket.external_customer_code) row("Cód. Cliente", ticket.external_customer_code);
        if (ticket.external_reference) row("Referência", ticket.external_reference);
        if (ticket.external_system) row("Sistema", ticket.external_system);
        y += 3;
      }

      // ── Lançamentos de Horas ──
      if (timeEntries.length > 0) {
        sectionTitle(`Lançamentos de Horas (${timeEntries.length})`);

        const sorted = [...timeEntries].sort((a, b) => {
          const ka = a.date ? `${a.date}T${a.start_time || "00:00"}` : a.created_date;
          const kb = b.date ? `${b.date}T${b.start_time || "00:00"}` : b.created_date;
          return new Date(ka) - new Date(kb);
        });

        // Table header
        checkPage(10);
        doc.setFillColor(235, 233, 250);
        doc.rect(marginL, y - 1, contentW, 7, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(88, 28, 235);
        const cols = [
          { label: "Data", x: marginL + 1, w: 32 },
          { label: "Analista", x: marginL + 34, w: 38 },
          { label: "Descrição", x: marginL + 74, w: 72 },
          { label: "Normal", x: marginL + 148, w: 18 },
          { label: "Extra", x: marginL + 167, w: 18 },
        ];
        cols.forEach(c => doc.text(c.label, c.x, y + 3.5));
        y += 8;
        doc.setTextColor(30, 30, 40);

        sorted.forEach((entry, idx) => {
          const cleanDesc = cleanTextForPdf(entry.description) || "—";
          const descLines = doc.splitTextToSize(cleanDesc, cols[2].w - 2);
          const rowH = Math.max(descLines.length * 4.5 + 2, 7);
          checkPage(rowH + 2);

          if (idx % 2 === 0) {
            doc.setFillColor(250, 250, 255);
            doc.rect(marginL, y - 1, contentW, rowH, "F");
          }

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(fmtEntryDate(entry.date) !== "—" ? fmtEntryDate(entry.date) : fmtDateShort(entry.created_date), cols[0].x, y + 3);
          doc.text(doc.splitTextToSize(entry.user_name || "—", cols[1].w - 2)[0], cols[1].x, y + 3);
          doc.text(descLines, cols[2].x, y + 3);
          doc.setFont("helvetica", "bold");
          doc.text(`${(entry.normal_hours || 0).toFixed(2)}h`, cols[3].x, y + 3);
          doc.setTextColor(entry.extra_hours > 0 ? 239 : 30, entry.extra_hours > 0 ? 68 : 30, 68);
          doc.text(`${(entry.extra_hours || 0).toFixed(2)}h`, cols[4].x, y + 3);
          doc.setTextColor(30, 30, 40);
          doc.setFont("helvetica", "normal");

          doc.setDrawColor(230, 230, 240);
          doc.line(marginL, y + rowH - 1, pageW - marginR, y + rowH - 1);
          y += rowH;
        });

        // Totals row
        checkPage(9);
        doc.setFillColor(235, 233, 250);
        doc.rect(marginL, y, contentW, 8, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(88, 28, 235);
        doc.text("TOTAL", marginL + 2, y + 5);
        doc.text(`${totalNormal.toFixed(2)}h`, cols[3].x, y + 5);
        doc.text(`${totalExtra.toFixed(2)}h`, cols[4].x, y + 5);
        y += 12;
      }

      // ── Observações Gerais ──
      if (ticket.observacoes_gerais) {
        sectionTitle("Observações Gerais");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 60);
        const obsLines = doc.splitTextToSize(cleanTextForPdf(ticket.observacoes_gerais), contentW - 4);
        obsLines.forEach((line) => {
          checkPage(6);
          doc.text(line, marginL + 2, y);
          y += 5;
        });
        y += 3;
      }

      // ── Histórico de Eventos (status, comentários, atribuições) ──
      if (events.length > 0) {
        const sortedEvents = [...events].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        sectionTitle(`Histórico de Eventos (${sortedEvents.length})`);

        sortedEvents.forEach((ev) => {
          checkPage(14);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(88, 28, 235);
          doc.text(fmtDate(ev.created_date), marginL, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 120);
          doc.text(ev.user_name || "Sistema", marginL + 40, y);
          y += 4.5;

          doc.setFontSize(8);
          doc.setTextColor(30, 30, 40);
          const evDescLines = doc.splitTextToSize(cleanTextForPdf(ev.description) || "—", contentW - 4);
          doc.text(evDescLines, marginL + 2, y);
          y += evDescLines.length * 4.3;

          if (ev.old_value && ev.new_value) {
            checkPage(6);
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 140);
            const changeLines = doc.splitTextToSize(
              `${cleanTextForPdf(ev.old_value)} -> ${cleanTextForPdf(ev.new_value)}`,
              contentW - 4
            );
            doc.text(changeLines, marginL + 2, y);
            y += changeLines.length * 4;
          }

          y += 2;
          doc.setDrawColor(230, 230, 240);
          doc.line(marginL, y - 1, pageW - marginR, y - 1);
          y += 2.5;
        });

        y += 2;
      }

      // ── E-mails trocados no ticket ──
      if (emails.length > 0) {
        const sortedEmails = [...emails].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        sectionTitle(`E-mails (${sortedEmails.length})`);

        sortedEmails.forEach((email) => {
          const isReceived = email.direction !== "sent";
          checkPage(24);

          // Destaque para retorno do cliente (e-mail recebido)
          if (isReceived) {
            doc.setFillColor(236, 253, 245);
            doc.rect(marginL, y - 3.5, contentW, 5.5, "F");
          }
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(isReceived ? 5 : 88, isReceived ? 150 : 28, isReceived ? 105 : 235);
          const dirLabel = isReceived ? "★ RETORNO DO CLIENTE (Recebido)" : "Enviado";
          doc.text(`${dirLabel} — ${fmtDate(email.created_date)}`, marginL + 1, y);
          y += 5;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 40);
          doc.setFontSize(7.5);
          doc.text(`De: ${cleanTextForPdf(email.from_name) || email.from_email || "—"}`, marginL, y);
          y += 4;
          if (email.to?.length) {
            const toLines = doc.splitTextToSize(`Para: ${email.to.join(", ")}`, contentW);
            checkPage(toLines.length * 4 + 2);
            doc.text(toLines, marginL, y);
            y += toLines.length * 4;
          }
          if (email.cc?.length) {
            const ccLines = doc.splitTextToSize(`Cc: ${email.cc.join(", ")}`, contentW);
            checkPage(ccLines.length * 4 + 2);
            doc.text(ccLines, marginL, y);
            y += ccLines.length * 4;
          }
          if (email.bcc?.length) {
            const bccLines = doc.splitTextToSize(`Cco: ${email.bcc.join(", ")}`, contentW);
            checkPage(bccLines.length * 4 + 2);
            doc.text(bccLines, marginL, y);
            y += bccLines.length * 4;
          }

          checkPage(8);
          doc.setFont("helvetica", "bold");
          const subjLines = doc.splitTextToSize(`Assunto: ${cleanTextForPdf(email.subject) || "—"}`, contentW);
          doc.text(subjLines, marginL, y);
          y += subjLines.length * 4.3 + 1;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 65);
          const bodyText = cleanTextForPdf(email.body) || "—";
          const bodyLines = doc.splitTextToSize(bodyText, contentW - 4);
          bodyLines.forEach((line) => {
            checkPage(5);
            doc.text(line, marginL + 2, y);
            y += 4.2;
          });

          if (email.attachments?.length) {
            checkPage(6);
            y += 1;
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 120);
            const attNames = email.attachments.map(a => a.file_name).filter(Boolean).join(", ");
            const attLines = doc.splitTextToSize(`Anexos: ${attNames || email.attachments.length}`, contentW - 4);
            doc.text(attLines, marginL + 2, y);
            y += attLines.length * 4;
          }

          y += 2.5;
          doc.setDrawColor(230, 230, 240);
          doc.line(marginL, y - 1, pageW - marginR, y - 1);
          y += 3;
          doc.setTextColor(30, 30, 40);
        });
      }

      // ── Footer on each page ──
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(160, 160, 180);
        doc.text(`Página ${p} de ${pageCount}`, pageW / 2, pageH - 7, { align: "center" });
        doc.text("Gerado por Unasys Tickets", marginL, pageH - 7);
        doc.text(ticketLabel, pageW - marginR, pageH - 7, { align: "right" });
      }

      const safeName = (ticket.title || "ticket").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      doc.save(`relatorio_${ticketLabel}_${safeName}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-1.5 h-9">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {loading ? "Gerando..." : "Exportar PDF"}
    </Button>
  );
}