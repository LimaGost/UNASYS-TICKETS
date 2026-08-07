import React from "react";
import { isToday, isThisWeek, isAfter, parseISO, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

export default function AgendaPanel({ appointments }) {
  const sortByDateTime = (a, b) =>
    (a.date + (a.start_time || "")).localeCompare(b.date + (b.start_time || ""));

  const today = appointments
    .filter((a) => a.date && isToday(parseISO(a.date)))
    .sort(sortByDateTime);

  const week = appointments.filter((a) => a.date && isThisWeek(parseISO(a.date), { weekStartsOn: 1 }));

  // Próximo evento futuro (quando não há nada hoje)
  const upcoming = appointments
    .filter((a) => a.date && isAfter(parseISO(a.date), startOfDay(new Date())) && !isToday(parseISO(a.date)))
    .sort(sortByDateTime)[0];

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">
        {today.length} evento{today.length !== 1 ? "s" : ""} hoje
      </p>

      {today.length === 0 ? (
        upcoming ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>
              Próximo: <span className="text-foreground font-medium">{upcoming.title}</span>
              {" — "}
              {format(parseISO(upcoming.date), "dd MMM", { locale: ptBR })}
              {upcoming.start_time ? ` às ${upcoming.start_time}` : ""}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum compromisso agendado.</p>
        )
      ) : (
        today.slice(0, 3).map((a) => (
          <div key={a.id} className="flex items-baseline gap-2 text-xs">
            <span className="font-bold text-primary flex-shrink-0">{a.start_time}</span>
            <span className="text-muted-foreground truncate uppercase">{a.title}</span>
          </div>
        ))
      )}

      <p className="text-sm text-muted-foreground pt-1">
        {week.length} evento{week.length !== 1 ? "s" : ""} esta semana
      </p>
    </div>
  );
}