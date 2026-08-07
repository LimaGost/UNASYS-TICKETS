import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import UrgencyBadge from "../shared/UrgencyBadge";
import { Mail, Clock, User, AlertCircle, TrendingUp, ChevronDown } from "lucide-react";
import { api } from "@/api/apiClient";
import { differenceInHours } from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
import { TZ } from "@/utils/dateUtils";

// Garante interpretação como UTC quando a string não traz offset explícito
function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}

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

  const current = ticket.sub_status;
  const colColor = column?.color || '#8B5CF6';

  if (subStatuses.length === 0) return null;

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all"
        style={{ background: current ? `${colColor}25` : 'rgba(255,255,255,0.05)', color: current ? colColor : 'rgba(255,255,255,0.3)', border: `1px solid ${current ? colColor + '40' : 'rgba(255,255,255,0.08)'}` }}
      >
        {current || 'Sub-status'}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-xl" style={{ background: '#1A0D2E', border: '1px solid rgba(139,92,246,0.3)', minWidth: 160 }}>
          {subStatuses.map((ss) => (
            <button key={ss} onMouseDown={(e) => handleSelect(e, ss)}
              className="w-full text-left px-3 py-2 text-[11px] transition-colors hover:bg-[rgba(139,92,246,0.15)]"
              style={{ color: ticket.sub_status === ss ? colColor : 'rgba(255,255,255,0.7)' }}
            >
              {ticket.sub_status === ss && <span className="mr-1">✓</span>}{ss}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KanbanCard({ ticket, column }) {
  const isOverdue = ticket.sla_breached;
  
  // Calculate SLA percentage
  const getSLAPercentage = () => {
    if (!ticket.expected_resolution || !ticket.created_date) return null;
    const now = new Date();
    const created = toUTC(ticket.created_date);
    const expected = toUTC(ticket.expected_resolution);
    const totalTime = differenceInHours(expected, created);
    const elapsed = differenceInHours(now, created);
    return Math.min(100, Math.round((elapsed / totalTime) * 100));
  };

  const slaPercentage = getSLAPercentage();

  return (
    <Link to={createPageUrl("TicketDetail") + `?id=${ticket.id}`}>
      <div
        className={`
          relative bg-gradient-to-br from-[#1a1f3a] to-[#0f1220] border rounded-lg p-3.5 cursor-grab active:cursor-grabbing
          hover:shadow-lg transition-all duration-200 group active:scale-95
          ${isOverdue 
            ? "border-[#EF4444]/40 shadow-lg shadow-[#EF4444]/15" 
            : "border-[rgba(139,92,246,0.25)] hover:border-[#8B5CF6]/60 hover:shadow-[#8B5CF6]/15"
          }
        `}
      >
        {/* Alert Badge */}
        {isOverdue && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#EF4444] rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-[#0B0D15]">
            <AlertCircle className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Title */}
        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug mb-2">
          {ticket.title}
        </h4>

        {/* Client + Urgency Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] flex-shrink-0" />
            <p className="text-[11px] text-gray-400 truncate">{ticket.client_name}</p>
          </div>
          <UrgencyBadge urgency={ticket.urgency} />
        </div>

        {/* SLA Info */}
        {ticket.expected_resolution && (
          <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 mb-3 pb-3 border-b border-[rgba(139,92,246,0.15)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {tzFormat(toZonedTime(toUTC(ticket.expected_resolution), TZ), "dd/MM HH:mm", { timeZone: TZ })}
            </span>
            {slaPercentage !== null && (
              <span className={`font-semibold px-2 py-0.5 rounded-md ${
                isOverdue ? "text-[#FCA5A5] bg-[#EF4444]/15" :
                slaPercentage >= 90 ? "text-[#F97316] bg-[#F97316]/15" :
                slaPercentage >= 70 ? "text-[#F59E0B] bg-[#F59E0B]/15" :
                "text-[#10B981] bg-[#10B981]/15"
              }`}>
                {slaPercentage}%
              </span>
            )}
          </div>
        )}

        {/* SLA Progress Bar */}
        {slaPercentage !== null && !isOverdue && (
          <div className="h-1 bg-[#0B0D15] rounded-full overflow-hidden mb-3">
            <div 
              className={`h-full transition-all duration-500 ${
                slaPercentage >= 90 ? "bg-[#F97316]" :
                slaPercentage >= 70 ? "bg-[#F59E0B]" :
                "bg-[#10B981]"
              }`}
              style={{ width: `${slaPercentage}%` }}
            />
          </div>
        )}

        {/* Horas contratadas vs gastas */}
        {ticket.contracted_hours > 0 && (() => {
          const used = (ticket.total_normal_hours || 0) + (ticket.total_extra_hours || 0);
          const pct = Math.min((used / ticket.contracted_hours) * 100, 100);
          const isOver = used > ticket.contracted_hours;
          const barColor = isOver ? "#EF4444" : pct > 80 ? "#F97316" : pct > 50 ? "#F59E0B" : "#10B981";
          return (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[9px] mb-1">
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Horas
                </span>
                <span style={{ color: barColor }} className="font-bold">
                  {used.toFixed(1)}h / {ticket.contracted_hours}h
                </span>
              </div>
              <div className="h-1.5 bg-[#0B0D15] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              {isOver && (
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: "#EF4444" }}>
                  ⚠ {(used - ticket.contracted_hours).toFixed(1)}h excedidas
                </p>
              )}
            </div>
          );
        })()}

        {/* Sub-status */}
        {column?.sub_statuses?.length > 0 && (
          <div className="mb-2">
            <SubStatusPicker ticket={ticket} column={column} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {ticket.assigned_to_name ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white">
                {ticket.assigned_to_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-gray-500 truncate">{ticket.assigned_to_name}</span>
            </div>
          ) : (
            <span className="text-[9px] text-gray-600">Não atribuído</span>
          )}
          {ticket.notified && (
            <div className="flex-shrink-0">
              <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}