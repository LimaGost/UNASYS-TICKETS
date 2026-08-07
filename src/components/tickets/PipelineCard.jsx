import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { api } from "@/api/apiClient";
import { differenceInHours, differenceInDays, isPast } from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
import { TZ } from "@/utils/dateUtils";

// Garante interpretação como UTC quando a string não traz offset explícito
function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}

const urgencyLabel = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };

function SubStatusPicker({ ticket, column }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const subStatuses = column?.sub_statuses || [];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (e, ss) => {
    e.preventDefault();
    e.stopPropagation();
    const newVal = ticket.sub_status === ss ? null : ss;
    await api.entities.Ticket.update(ticket.id, { sub_status: newVal });
    setOpen(false);
  };

  if (subStatuses.length === 0) return null;

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {ticket.sub_status || 'Sub-status'}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg bg-popover border border-border" style={{ minWidth: 160 }}>
          {subStatuses.map((ss) => (
            <button key={ss} onMouseDown={(e) => handleSelect(e, ss)}
              className={`w-full text-left px-3 py-2 text-[11px] transition-colors hover:bg-muted ${ticket.sub_status === ss ? "text-primary font-medium" : "text-foreground"}`}
            >
              {ticket.sub_status === ss && <span className="mr-1">✓</span>}{ss}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelineCard({ ticket, column, ticketNumber }) {
  const navigate = useNavigate();
  const isFinalColumn = column?.is_final === true;

  const slaPaused = !!ticket.sla_paused_at && !isFinalColumn;
  const expected = (ticket.expected_resolution && !isFinalColumn) ? toUTC(ticket.expected_resolution) : null;
  const overdue = !isFinalColumn && !slaPaused && (ticket.sla_breached || (expected && isPast(expected)));
  const dueLabel = expected ? tzFormat(toZonedTime(expected, TZ), "dd/MM", { timeZone: TZ }) : null;

  const slaPercent = (() => {
    if (!expected || !ticket.created_date) return null;
    const created = toUTC(ticket.created_date);
    const total = differenceInHours(expected, created);
    if (total <= 0) return 100;
    const elapsed = differenceInHours(new Date(), created);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  })();

  const timeOpen = (() => {
    if (!ticket.created_date) return null;
    const created = toUTC(ticket.created_date);
    const days = differenceInDays(new Date(), created);
    return days > 0 ? `${days}d aberto` : `${differenceInHours(new Date(), created)}h aberto`;
  })();

  // Navega apenas em clique real (não no drop após arrastar)
  const handleClick = (e) => {
    if (e.defaultPrevented) return;
    navigate(`/ticket/${ticket.id}`);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className="group rounded-lg border border-border bg-card p-3 cursor-pointer transition-all duration-200 hover:shadow-sm hover:border-muted-foreground/30"
    >
      {/* Essencial: número + título */}
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-mono tabular-nums leading-4">
          #{String(ticketNumber).padStart(4, "0")}
        </span>
        <h4 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 min-w-0">
          {ticket.title}
        </h4>
      </div>

      {/* Essencial: responsável + prazo */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {ticket.assigned_to_name ? (
            <>
              <div className="w-[18px] h-[18px] rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground flex-shrink-0">
                {ticket.assigned_to_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] text-muted-foreground truncate">{ticket.assigned_to_name}</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">Não atribuído</span>
          )}
        </div>
        {slaPaused ? (
          <span className="flex items-center gap-1.5 text-[11px] flex-shrink-0 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            SLA pausado{ticket.sub_status ? ` · ${ticket.sub_status}` : ""}
          </span>
        ) : dueLabel && (
          <span className={`flex items-center gap-1.5 text-[11px] flex-shrink-0 tabular-nums ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${overdue ? "bg-destructive" : "bg-muted-foreground/40"}`} />
            {dueLabel}
          </span>
        )}
      </div>

      {/* Detalhes secundários — revelados no hover */}
      <div className="max-h-0 overflow-hidden opacity-0 group-hover:max-h-32 group-hover:opacity-100 transition-all duration-300 ease-out">
        <div className="pt-2.5 mt-2.5 border-t border-border space-y-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{urgencyLabel[ticket.urgency] || "Média"}</span>
            {ticket.service_type && <span className="truncate max-w-[100px]">{ticket.service_type}</span>}
          </div>
          {slaPercent != null && (
            <div className="h-0.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overdue ? "bg-destructive" : "bg-primary/50"}`}
                style={{ width: `${slaPercent}%` }}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            {timeOpen && <span className="text-[10px] text-muted-foreground">{timeOpen}</span>}
            {column?.sub_statuses?.length > 0 && <SubStatusPicker ticket={ticket} column={column} />}
          </div>
        </div>
      </div>
    </div>
  );
}