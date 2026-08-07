import React, { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, CalendarDays,
  Clock, Building2, CalendarCheck, Plus, CalendarClock, List,
  Users, LayoutGrid, Eye
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday,
  parseISO, isThisWeek, setHours, setMinutes
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import AppointmentModal from "../components/agenda/AppointmentModal";

const APPT_TYPE_CONFIG = {
  reuniao:    { label: "Reunião",     color: "#8B5CF6", icon: "🤝" },
  visita:     { label: "Visita",      color: "#3B82F6", icon: "📍" },
  treinamento:{ label: "Treinamento", color: "#10B981", icon: "📚" },
  entrega:    { label: "Entrega",     color: "#F59E0B", icon: "📦" },
  followup:   { label: "Follow-up",   color: "#EC4899", icon: "📞" },
  outro:      { label: "Outro",       color: "#6B7280", icon: "📌" },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const SLOT_HEIGHT = 56; // px per hour slot

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToPx(minutes) {
  return (minutes / 60) * SLOT_HEIGHT;
}

// Calcula colunas lado a lado para compromissos que se sobrepõem no mesmo dia
function layoutAppointments(appts) {
  const events = appts.map(a => {
    const start = timeToMinutes(a.start_time);
    const rawEnd = a.end_time ? timeToMinutes(a.end_time) : start + 60;
    return { a, start, end: Math.max(rawEnd, start + 30) };
  }).sort((x, y) => x.start - y.start || y.end - x.end);

  const layout = {};
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(ev => {
      let col = colEnds.findIndex(end => end <= ev.start);
      if (col === -1) { col = colEnds.length; colEnds.push(ev.end); }
      else colEnds[col] = ev.end;
      ev.col = col;
    });
    const total = colEnds.length;
    cluster.forEach(ev => { layout[ev.a.id] = { col: ev.col, cols: total }; });
    cluster = [];
  };

  events.forEach(ev => {
    if (cluster.length && ev.start >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end);
  });
  flush();
  return layout;
}

// ── Attendee avatars ─────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#8B5CF6","#3B82F6","#10B981","#F59E0B","#EC4899","#EF4444","#06B6D4","#84CC16"];
function getAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AttendeeAvatars({ attendees = [], internalUsers = [], max = 3, size = "sm" }) {
  if (!attendees.length) return null;
  const visible = attendees.slice(0, max);
  const extra = attendees.length - max;
  const sz = size === "xs" ? "w-4 h-4 text-[8px]" : size === "md" ? "w-6 h-6 text-[10px]" : "w-5 h-5 text-[9px]";
  return (
    <span className="flex items-center">
      {visible.map((email, i) => {
        const u = internalUsers.find(u => u.email === email);
        const initials = u?.full_name ? u.full_name.split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase() : email[0].toUpperCase();
        const bg = getAvatarColor(email);
        return (
          <span key={email} title={u?.full_name || email}
            className={`${sz} rounded-full text-white font-bold flex items-center justify-center ring-2 ring-background flex-shrink-0 shadow-sm`}
            style={{ marginLeft: i > 0 ? "-5px" : 0, background: bg }}>
            {initials}
          </span>
        );
      })}
      {extra > 0 && (
        <span className={`${sz} rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center ring-2 ring-background flex-shrink-0`}
          style={{ marginLeft: "-5px" }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

// ── Time grid (used by week and day views) ──────────────────────────────────
function TimeGrid({ days, apptsByDate, onSlotClick, onEditAppt, onMoveAppt, showDayHeaders = true, internalUsers = [] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const gridRef = useRef(null);

  // Drag state
  const dragRef = useRef(null); // { appt, startMouseY, startMouseX, origTop, dayIndex, columnWidth, headerOffset }
  const [dragging, setDragging] = useState(null); // { apptId, top, dayKey }

  const handleMouseDown = useCallback((e, a, dayIndex) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startMin = timeToMinutes(a.start_time);
    const endMin = a.end_time ? timeToMinutes(a.end_time) : startMin + 60;
    const duration = endMin - startMin;
    const headerOffset = showDayHeaders ? 48 : 0;
    const origTop = headerOffset + minutesToPx(startMin);

    dragRef.current = { appt: a, startMouseY: e.clientY, startMouseX: e.clientX, origTop, dayIndex, duration };
    setDragging({ apptId: a.id, top: origTop, dayIndex });

    const onMouseMove = (ev) => {
      if (!dragRef.current) return;
      const { origTop, startMouseY } = dragRef.current;
      const dy = ev.clientY - startMouseY;
      const newTop = Math.max(headerOffset, origTop + dy);

      // Determine which column the mouse is over
      if (gridRef.current) {
        const cols = gridRef.current.querySelectorAll("[data-day-col]");
        let newDayIndex = dragRef.current.dayIndex;
        cols.forEach((col, i) => {
          const rect = col.getBoundingClientRect();
          if (ev.clientX >= rect.left && ev.clientX <= rect.right) newDayIndex = i;
        });
        dragRef.current.dayIndex = newDayIndex;
        setDragging({ apptId: a.id, top: newTop, dayIndex: newDayIndex });
      }
    };

    const onMouseUp = (ev) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (!dragRef.current) return;

      const { appt, origTop, startMouseY, dayIndex, duration } = dragRef.current;
      const dy = ev.clientY - startMouseY;
      const newTop = Math.max(headerOffset, origTop + dy);

      // Snap to 15-minute intervals
      const rawMinutes = ((newTop - headerOffset) / SLOT_HEIGHT) * 60;
      const snapped = Math.round(rawMinutes / 15) * 15;
      const newStart = Math.max(0, Math.min(snapped, 23 * 60 + 45));
      const newEnd = newStart + duration;

      const hh = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const newDay = days[dragRef.current.dayIndex];
      const newDate = format(newDay, "yyyy-MM-dd");

      const changed = newDate !== appt.date || hh(newStart) !== appt.start_time;
      if (changed) {
        onMoveAppt(appt, newDate, hh(newStart), appt.end_time ? hh(newEnd) : null);
      } else if (Math.abs(dy) < 5) {
        onEditAppt(appt);
      }

      dragRef.current = null;
      setDragging(null);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [days, showDayHeaders, onEditAppt, onMoveAppt]);

  return (
    <div className="flex flex-1 overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
      {/* Hour labels */}
      <div className="flex-shrink-0 w-14 border-r border-border">
        {showDayHeaders && <div className="h-12 border-b border-border" />}
        {HOURS.map(h => (
          <div key={h} className="flex items-start justify-end pr-2 text-[10px] text-muted-foreground border-b border-border/30"
            style={{ height: SLOT_HEIGHT }}>
            {h > 0 && <span className="-mt-2">{String(h).padStart(2, "0")}:00</span>}
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1 min-w-0" ref={gridRef}>
        {days.map((day, dayIndex) => {
          const key = format(day, "yyyy-MM-dd");
          const isCurrentDay = isToday(day);
          const appts = (apptsByDate[key] || []).filter(a => a.start_time);
          const allDayAppts = (apptsByDate[key] || []).filter(a => !a.start_time);
          const isDragTarget = dragging && dragging.dayIndex === dayIndex;

          return (
            <div key={key} data-day-col={dayIndex} className={`flex-1 relative border-r border-border/50 min-w-[100px] transition-colors ${isDragTarget ? "bg-primary/5" : ""}`}>
              {/* Day header */}
              {showDayHeaders && (
                <div className={`h-12 flex flex-col items-center justify-center border-b sticky top-0 z-10
                  ${isCurrentDay ? "bg-primary/10" : "bg-card"}
                  border-border`}>
                  <span className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE", { locale: ptBR })}</span>
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mt-0.5
                    ${isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                    {format(day, "d")}
                  </span>
                </div>
              )}

              {/* All-day row */}
              {allDayAppts.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-20 flex flex-col gap-0.5 p-0.5"
                  style={{ top: showDayHeaders ? 48 : 0 }}>
                  {allDayAppts.map(a => {
                    const cfg = APPT_TYPE_CONFIG[a.type] || APPT_TYPE_CONFIG.outro;
                    const color = a.color || cfg.color;
                    return (
                      <div key={a.id}
                        className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                        style={{ background: color + "30", borderLeft: `2px solid ${color}`, color }}
                        onClick={(e) => { e.stopPropagation(); onEditAppt(a); }}>
                        {cfg.icon} {a.title}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hour slots */}
              {HOURS.map(h => (
                <div key={h}
                  className="border-b border-border/20 hover:bg-primary/5 cursor-pointer group relative transition-colors"
                  style={{ height: SLOT_HEIGHT }}
                  onClick={() => onSlotClick(day, h)}>
                  <div className="absolute left-0 right-0 border-b border-dashed border-border/20"
                    style={{ top: SLOT_HEIGHT / 2 }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onSlotClick(day, h); }}
                    title="Adicionar compromisso neste horário"
                    className="absolute top-0.5 right-0.5 z-30 w-4 h-4 rounded-full bg-primary/70 hover:bg-primary text-primary-foreground flex items-center justify-center opacity-40 hover:opacity-100 transition-all">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {/* Now indicator */}
              {isCurrentDay && (
                <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                  style={{ top: (showDayHeaders ? 48 : 0) + minutesToPx(nowMinutes) }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              )}

              {/* Appointment blocks */}
              {(() => { const apptLayout = layoutAppointments(appts); return appts.map(a => {
                const cfg = APPT_TYPE_CONFIG[a.type] || APPT_TYPE_CONFIG.outro;
                const color = a.color || cfg.color;
                const startMin = timeToMinutes(a.start_time);
                const endMin = a.end_time ? timeToMinutes(a.end_time) : startMin + 60;
                const baseTop = (showDayHeaders ? 48 : 0) + minutesToPx(startMin);
                const height = Math.max(minutesToPx(endMin - startMin), 24);
                const isDraggingThis = dragging?.apptId === a.id;
                // Show ghost in original column while dragging to another column
                const showGhost = isDraggingThis && dragging.dayIndex !== dayIndex;
                // Show floating card in target column
                const showFloat = isDraggingThis && dragging.dayIndex === dayIndex;
                const top = showFloat ? dragging.top : baseTop;
                const { col = 0, cols = 1 } = apptLayout[a.id] || {};
                const leftPct = (col / cols) * 100;
                const widthPct = 100 / cols;

                return (
                  <React.Fragment key={a.id}>
                    {/* Ghost (original position, faded) */}
                    {showGhost && (
                      <div className="absolute rounded-md z-20 px-2 py-1 pointer-events-none"
                        style={{ top: baseTop, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, background: color + "11", borderLeft: `3px solid ${color}44`, opacity: 0.4 }} />
                    )}
                    <div
                      className={`absolute rounded-md overflow-hidden z-20 px-2 py-1 select-none
                        ${isDraggingThis ? "cursor-grabbing shadow-xl ring-2 ring-primary/40 opacity-95" : "cursor-grab hover:brightness-110"}`}
                      style={{
                        top,
                        height,
                        left: isDraggingThis ? 2 : `calc(${leftPct}% + 2px)`,
                        width: isDraggingThis ? "calc(100% - 4px)" : `calc(${widthPct}% - 4px)`,
                        background: color + "22",
                        borderLeft: `3px solid ${color}`,
                        boxShadow: isDraggingThis ? `0 8px 24px ${color}44` : `0 1px 4px ${color}22`,
                        transition: isDraggingThis ? "none" : "box-shadow 0.15s",
                        userSelect: "none",
                      }}
                      onMouseDown={(e) => handleMouseDown(e, a, dayIndex)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden", width: "100%" }}>
                        {height > 28 && <span style={{ fontSize: 10, flexShrink: 0, lineHeight: 1 }}>{cfg.icon}</span>}
                        <p style={{ color, fontSize: 10, fontWeight: 600, lineHeight: 1.2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>{a.title}</p>
                      </div>
                      {height > 36 && <p className="text-[9px] opacity-60 mt-0.5 truncate" style={{ color }}>{a.start_time}{a.end_time ? `–${a.end_time}` : ""}</p>}
                      {height > 52 && a.attendees?.length > 0 && (
                        <div className="mt-1">
                          <AttendeeAvatars attendees={a.attendees} internalUsers={internalUsers} max={3} size="xs" />
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              }); })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Month view day cell chip ─────────────────────────────────────────────────
function DayChip({ item, onEdit, internalUsers = [] }) {
  const cfg = APPT_TYPE_CONFIG[item.type] || APPT_TYPE_CONFIG.outro;
  const color = item.color || cfg.color;
  const attendeeNames = (item.attendees || []).map(e => internalUsers.find(u => u.email === e)?.full_name || e).join(", ");
  return (
    <div className="rounded-md px-1.5 py-0.5 text-xs truncate cursor-pointer hover:brightness-105 flex items-center gap-1"
      style={{ backgroundColor: color + "22", borderLeft: `2px solid ${color}`, color, boxShadow: `0 1px 3px ${color}18` }}
      title={item.attendees?.length ? `${item.title}\nParticipantes: ${attendeeNames}` : item.title}
      onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
      <span className="flex-shrink-0 text-[9px]">{cfg.icon}</span>
      {item.start_time && <span className="opacity-60 flex-shrink-0 text-[9px] font-medium">{item.start_time}</span>}
      <span className="truncate flex-1 font-medium">{item.title}</span>
      {item.attendees?.length > 0 && (
        <span className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
          <Users className="w-2.5 h-2.5 opacity-70" /><span className="text-[9px] opacity-70">{item.attendees.length}</span>
        </span>
      )}
    </div>
  );
}

// ── Side panel card ──────────────────────────────────────────────────────────
function SideCard({ item, onEdit, internalUsers = [] }) {
  const cfg = APPT_TYPE_CONFIG[item.type] || APPT_TYPE_CONFIG.outro;
  const color = item.color || cfg.color;
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3 border cursor-pointer hover:scale-[1.01] transition-all"
      style={{ backgroundColor: color + "14", borderColor: color + "50", borderLeftWidth: 3, borderLeftColor: color, boxShadow: `0 2px 8px ${color}18` }}
      onClick={() => onEdit(item)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0 leading-none">{cfg.icon}</span>
          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        </div>
        <Badge className="text-[10px] px-2 py-0.5 border-0 shrink-0 rounded-full font-semibold" style={{ background: color + "30", color }}>{cfg.label}</Badge>
      </div>
      {/* Time & client */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {item.start_time && (
          <span className="flex items-center gap-1 font-semibold rounded-md px-1.5 py-0.5" style={{ color, background: color + "18" }}>
            <Clock className="w-3 h-3" />{item.start_time}{item.end_time ? `–${item.end_time}` : ""}
          </span>
        )}
        {item.client_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.client_name}</span>}
      </div>
      {/* Attendees */}
      {item.attendees?.length > 0 && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: color + "25" }}>
          <AttendeeAvatars attendees={item.attendees} internalUsers={internalUsers} max={5} size="md" />
          <span className="text-[11px] text-muted-foreground font-medium">
            {item.attendees.length} participante{item.attendees.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("agenda_view_mode") || "week");
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterVertical, setFilterVertical] = useState(() => localStorage.getItem("agenda_filter_vertical") || "all");
  const [filterUsers, setFilterUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agenda_filter_users")) || []; } catch { return []; }
  }); // array of emails, empty = todos

  React.useEffect(() => { localStorage.setItem("agenda_view_mode", viewMode); }, [viewMode]);
  React.useEffect(() => { localStorage.setItem("agenda_filter_vertical", filterVertical); }, [filterVertical]);
  React.useEffect(() => { localStorage.setItem("agenda_filter_users", JSON.stringify(filterUsers)); }, [filterUsers]);
  const [showApptModal, setShowApptModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState(null);
  const [modalInitialDate, setModalInitialDate] = useState(null);
  const [modalInitialTime, setModalInitialTime] = useState(null);
  const queryClient = useQueryClient();

  const handleMoveAppt = useCallback(async (appt, newDate, newStartTime, newEndTime) => {
    try {
      await api.entities.Appointment.update(appt.id, {
        date: newDate,
        start_time: newStartTime,
        ...(newEndTime ? { end_time: newEndTime } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e) {
      console.error("Erro ao mover compromisso", e);
    }
  }, [queryClient]);

  const { data: verticals = [] } = useQuery({ queryKey: ["verticals"], queryFn: () => api.entities.Vertical.list() });
  const { data: appointments = [] } = useQuery({ queryKey: ["appointments"], queryFn: () => api.entities.Appointment.list() });
  const { data: currentUser } = useQuery({ queryKey: ["currentUser"], queryFn: () => api.auth.me() });
  const { data: internalUsersRaw } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: () => api.functions.invoke("listInternalUsers", {}),
  });
  const internalUsers = useMemo(() => {
    const u = internalUsersRaw?.data?.users;
    return Array.isArray(u) ? u : [];
  }, [internalUsersRaw]);

  // Users of the selected vertical for the filter dropdown
  const verticalUsers = useMemo(() => {
    const vCode = filterVertical !== "all" ? filterVertical : null;
    return internalUsers.filter(u => !vCode || u.vertical === vCode);
  }, [internalUsers, filterVertical]);

  const filteredAppointments = useMemo(() => appointments.filter(a => {
    if (filterVertical !== "all" && a.vertical !== filterVertical) return false;
    if (filterUsers.length > 0) {
      const isOwner = filterUsers.includes(a.owner_email);
      const isAttendee = (a.attendees || []).some(e => filterUsers.includes(e));
      if (!isOwner && !isAttendee) return false;
    }
    return true;
  }), [appointments, filterVertical, filterUsers]);

  const apptsByDate = useMemo(() => {
    const map = {};
    filteredAppointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push({ ...a, _kind: "appointment" });
    });
    return map;
  }, [filteredAppointments]);

  const getItemsForDate = (dateKey) =>
    (apptsByDate[dateKey] || []).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const days = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const todayItems = getItemsForDate(format(new Date(), "yyyy-MM-dd"));

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    return getItemsForDate(format(selectedDay, "yyyy-MM-dd"));
  }, [selectedDay, apptsByDate]);

  const listViewItems = useMemo(() => {
    if (viewMode !== "list") return [];
    const today = new Date();
    const end = addDays(today, 60);
    const groups = [];
    let d = today;
    while (d <= end) {
      const key = format(d, "yyyy-MM-dd");
      const items = getItemsForDate(key);
      if (items.length > 0) groups.push({ date: d, key, items });
      d = addDays(d, 1);
    }
    return groups;
  }, [viewMode, apptsByDate]);

  const navigate = (dir) => {
    const delta = dir === "prev" ? -1 : 1;
    if (viewMode === "month") setCurrentDate(d => delta < 0 ? subMonths(d, 1) : addMonths(d, 1));
    else if (viewMode === "week") setCurrentDate(d => addDays(d, delta * 7));
    else if (viewMode === "day") setCurrentDate(d => addDays(d, delta));
    else setCurrentDate(d => addDays(d, delta * 30));
  };

  const goToToday = () => setCurrentDate(new Date());

  const openNewAppt = (day, hour = null) => {
    setEditingAppt(null);
    const d = day || selectedDay || new Date();
    setModalInitialDate(d);
    setModalInitialTime(hour !== null ? `${String(hour).padStart(2, "0")}:00` : null);
    setShowApptModal(true);
  };

  const openEditAppt = (appt) => {
    setEditingAppt(appt);
    setModalInitialDate(null);
    setModalInitialTime(null);
    setShowApptModal(true);
  };

  const handleDayClick = (day) => {
    if (viewMode === "month") {
      setSelectedDay(isSameDay(day, selectedDay) ? null : day);
    } else if (viewMode === "week") {
      // Switch to day view on day header click
      setCurrentDate(day);
      setViewMode("day");
    }
  };

  const headerTitle = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "week") return `${format(weekDays[0], "d MMM", { locale: ptBR })} – ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`;
    if (viewMode === "day") return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    return "Próximos 60 dias";
  };

  const statsCards = [
    { label: "Compromissos", value: filteredAppointments.length, icon: CalendarClock, color: "#8B5CF6" },
    { label: "Hoje", value: todayItems.length, icon: Clock, color: "#10B981" },
  ];

  const views = [
    { v: "day",   icon: CalendarDays, label: "Dia" },
    { v: "week",  icon: LayoutGrid,   label: "Semana" },
    { v: "month", icon: CalendarDays, label: "Mês" },
    { v: "list",  icon: List,         label: "Lista" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            Agenda
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 ml-11">Compromissos e previsões de resolução</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterVertical} onValueChange={setFilterVertical}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Verticais</SelectItem>
              {verticals.filter(v => v.active).map(v => (
                <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Multi-user filter */}
          {verticalUsers.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-all
                  ${filterUsers.length > 0
                    ? "ring-2 ring-primary border-primary bg-primary/5 text-primary"
                    : "border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                  {filterUsers.length === 0 ? (
                    <>
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-xs">Analistas</span>
                    </>
                  ) : filterUsers.length === 1 ? (
                    <>
                      <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: getAvatarColor(filterUsers[0]) }}>
                        {(verticalUsers.find(u => u.email === filterUsers[0])?.full_name || filterUsers[0])[0].toUpperCase()}
                      </span>
                      <span className="text-xs font-medium truncate max-w-[90px]">
                        {filterUsers[0] === currentUser?.email ? "Minha agenda" : (verticalUsers.find(u => u.email === filterUsers[0])?.full_name || filterUsers[0]).split(" ")[0]}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex -space-x-1">
                        {filterUsers.slice(0, 3).map(email => (
                          <span key={email} className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-background"
                            style={{ background: getAvatarColor(email) }}>
                            {(verticalUsers.find(u => u.email === email)?.full_name || email)[0].toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs font-medium">{filterUsers.length} analistas</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="mb-2 px-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtrar por analista</span>
                  {filterUsers.length > 0 && (
                    <button onClick={() => setFilterUsers([])} className="text-[11px] text-primary hover:underline">Limpar</button>
                  )}
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {[...(currentUser ? [currentUser] : []), ...verticalUsers.filter(u => u.email !== currentUser?.email)].map(u => {
                    const checked = filterUsers.includes(u.email);
                    return (
                      <label key={u.email} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setFilterUsers(prev => v ? [...prev, u.email] : prev.filter(e => e !== u.email))}
                        />
                        <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: getAvatarColor(u.email) }}>
                          {(u.full_name || u.email)[0].toUpperCase()}
                        </span>
                        <span className="text-sm text-foreground truncate flex-1">
                          {u.email === currentUser?.email ? `${u.full_name || u.email} (eu)` : (u.full_name || u.email)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* View mode */}
          <div className="flex bg-muted border border-border rounded-lg overflow-hidden h-9">
            {views.map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => { setViewMode(v); if (v === "day") setCurrentDate(new Date()); }}
                className={`flex items-center gap-1.5 px-3 text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          <Button onClick={() => openNewAppt(null)} className="h-9 gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statsCards.map(({ label, value, icon: StatIcon, color }) => (
          <div key={label} className="rounded-xl p-3.5 flex items-center gap-3 border"
            style={{ background: color + "10", borderColor: color + "30" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
              <StatIcon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: color + "cc" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main area */}
        <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          {/* Nav bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-sm font-semibold text-foreground capitalize px-2 min-w-[200px] text-center">{headerTitle()}</h2>
              <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={goToToday}
              className="text-xs text-primary h-7 px-3">
              Hoje
            </Button>
          </div>

          {/* ── WEEK VIEW ── */}
          {viewMode === "week" && (
            <>
              {/* Day header row with click-to-day */}
              <div className="grid border-b border-border flex-shrink-0" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
                <div />
                {weekDays.map(day => {
                  const isDayToday = isToday(day);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <button key={format(day, "yyyy-MM-dd")}
                      className={`py-2 flex flex-col items-center border-r border-border/30 hover:bg-muted/50 transition-colors ${isWeekend ? "opacity-60" : ""}`}
                      onClick={() => { setCurrentDate(day); setViewMode("day"); }}>
                      <span className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE", { locale: ptBR })}</span>
                      <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mt-0.5 transition-colors
                      ${isDayToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <TimeGrid
                days={weekDays}
                apptsByDate={apptsByDate}
                onSlotClick={(day, hour) => openNewAppt(day, hour)}
                onEditAppt={openEditAppt}
                onMoveAppt={handleMoveAppt}
                showDayHeaders={false}
                internalUsers={internalUsers}
              />
            </>
          )}

          {/* ── DAY VIEW ── */}
          {viewMode === "day" && (
            <>
              <div className="px-4 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full
                    ${isToday(currentDate) ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                    {format(currentDate, "d")}
                  </span>
                  <span className="text-sm text-muted-foreground capitalize">{format(currentDate, "EEEE 'de' MMMM", { locale: ptBR })}</span>
                  <Button size="sm" variant="outline" onClick={() => openNewAppt(currentDate)}
                    className="ml-auto h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar
                  </Button>
                </div>
              </div>
              <TimeGrid
                days={[currentDate]}
                apptsByDate={apptsByDate}
                onSlotClick={(day, hour) => openNewAppt(day, hour)}
                onEditAppt={openEditAppt}
                onMoveAppt={handleMoveAppt}
                showDayHeaders={false}
                internalUsers={internalUsers}
              />
            </>
          )}

          {/* ── MONTH VIEW ── */}
          {viewMode === "month" && (
            <>
              <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
                {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d, i) => (
                  <div key={d} className={`py-2 text-center text-xs font-semibold ${i === 0 || i === 6 ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 flex-1">
                {monthDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const items = getItemsForDate(key);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isDayToday = isToday(day);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <div key={key}
                      className={`border-r border-b border-border/30 p-1.5 cursor-pointer transition-all group min-h-[100px]
                        ${!isCurrentMonth ? "opacity-25" : ""}
                        ${isWeekend && !isDayToday ? "bg-muted/20" : ""}
                        ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/30"}`}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-all
                          ${isDayToday ? "bg-primary text-primary-foreground" : isSelected ? "text-primary" : isWeekend ? "text-muted-foreground/60" : "text-foreground"}`}>
                          {format(day, "d")}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/15 transition-all"
                          onClick={(e) => { e.stopPropagation(); openNewAppt(day); }}>
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((item, i) => (
                          <DayChip key={item.id || i} item={item} onEdit={openEditAppt} internalUsers={internalUsers} />
                        ))}
                        {items.length > 2 && (
                          <button className="text-[10px] text-primary px-1 hover:underline"
                            onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}>
                            +{items.length - 2} mais
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── LIST VIEW ── */}
          {viewMode === "list" && (
            listViewItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum item nos próximos 60 dias</p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-auto">
                {listViewItems.map(({ date, key, items }) => {
                  const isDayToday = isToday(date);
                  return (
                    <div key={key} className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${isDayToday ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          {isDayToday ? "Hoje" : format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </div>
                        <div className="flex-1 h-px bg-border" />
                        <button className="text-[10px] text-primary hover:underline"
                          onClick={() => openNewAppt(date)}>+ Novo</button>
                      </div>
                      <div className="space-y-2 pl-2">
                        {items.map((item, i) => {
                          const cfg = APPT_TYPE_CONFIG[item.type] || APPT_TYPE_CONFIG.outro;
                          const color = item.color || cfg.color;
                          return (
                            <div key={item.id || i}
                              className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:opacity-90 transition-all"
                              style={{ background: color + "12", borderColor: color + "35", borderLeftWidth: 3, borderLeftColor: color }}
                              onClick={() => openEditAppt(item)}>
                              <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                  <Badge className="text-[10px] px-1.5 py-0 border-0 flex-shrink-0" style={{ background: color + "30", color }}>{cfg.label}</Badge>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                                 {item.start_time && <span className="flex items-center gap-1" style={{ color }}><Clock className="w-3 h-3" />{item.start_time}{item.end_time ? `–${item.end_time}` : ""}</span>}
                                 {item.client_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{item.client_name}</span>}
                                </div>
                                {item.attendees?.length > 0 && (
                                 <div className="flex items-center gap-2 mt-1.5">
                                   <AttendeeAvatars attendees={item.attendees} internalUsers={internalUsers} max={4} size="sm" />
                                   <span className="text-[10px] text-muted-foreground">{item.attendees.length} part.</span>
                                 </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Side Panel */}
        <div className="lg:w-72 xl:w-80 space-y-4 flex-shrink-0">
          {/* Day detail */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedDay
                    ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })
                    : `Hoje, ${format(new Date(), "d 'de' MMMM", { locale: ptBR })}`}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(selectedDay ? selectedDayItems : todayItems).length} itens
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openNewAppt(selectedDay || new Date())}
                className="h-7 text-xs px-2.5 gap-1 text-primary">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {(selectedDay ? selectedDayItems : todayItems).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Nenhum item</p>
                <button onClick={() => openNewAppt(selectedDay || new Date())}
                  className="text-xs text-primary mt-1 hover:underline">
                  + Adicionar compromisso
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar">
                {(selectedDay ? selectedDayItems : todayItems).map((item, i) => (
                  <SideCard key={item.id || i} item={item} onEdit={openEditAppt} internalUsers={internalUsers} />
                ))}
              </div>
            )}
          </div>

          {/* Esta semana */}
          {(() => {
            const weekAppts = filteredAppointments.filter(a => {
              try { return isThisWeek(parseISO(a.date), { weekStartsOn: 0 }) && !isToday(parseISO(a.date)); } catch { return false; }
            });
            if (weekAppts.length === 0) return null;
            return (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-blue-400" /> Esta semana
                  </h3>
                </div>
                <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {weekAppts.slice(0, 5).map(a => {
                    const cfg = APPT_TYPE_CONFIG[a.type] || APPT_TYPE_CONFIG.outro;
                    const color = a.color || cfg.color;
                    return (
                      <div key={a.id}                         className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => openEditAppt(a)}>
                        <span className="text-sm flex-shrink-0">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {format(parseISO(a.date), "EEE, d MMM", { locale: ptBR })}{a.start_time ? ` · ${a.start_time}` : ""}
                            </p>
                            {a.attendees?.length > 0 && (
                              <AttendeeAvatars attendees={a.attendees} internalUsers={internalUsers} max={2} size="xs" />
                            )}
                          </div>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <AppointmentModal
        open={showApptModal}
        onOpenChange={(v) => { setShowApptModal(v); if (!v) { setEditingAppt(null); setModalInitialTime(null); } }}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        appointment={editingAppt}
        verticals={verticals}
      />
    </div>
  );
}