import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Timer, CheckCircle } from "lucide-react";
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

const TZ = "America/Sao_Paulo";
function nowBR() { return toZonedTime(new Date(), TZ); }
function fmtDate(d) { return tzFormat(d, "yyyy-MM-dd", { timeZone: TZ }); }
function fmtTime(d) { return tzFormat(d, "HH:mm", { timeZone: TZ }); }

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TimerControl({ ticketId, onTimeComplete }) {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);

  const { data: activeSession } = useQuery({
    queryKey: ["activeSession", ticketId],
    queryFn: async () => {
      const user = await api.auth.me();
      const sessions = await api.entities.TicketSession.filter({
        ticket_id: ticketId,
        user_email: user.email,
        status: { $in: ["active", "paused"] }
      });
      return sessions[0] || null;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    if (activeSession.status === "paused") { setElapsed(activeSession.total_seconds || 0); return; }

    const referenceTime = new Date(activeSession.paused_at || activeSession.started_at).getTime();
    const previousSeconds = activeSession.total_seconds || 0;

    const interval = setInterval(() => {
      setElapsed(previousSeconds + Math.floor((Date.now() - referenceTime) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [activeSession]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const user = await api.auth.me();
      await api.entities.TicketSession.create({
        ticket_id: ticketId,
        started_at: new Date().toISOString(), // UTC para o banco
        status: "active",
        user_email: user.email,
        user_name: user.full_name,
        total_seconds: 0,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activeSession", ticketId] }),
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      await api.entities.TicketSession.update(activeSession.id, {
        paused_at: new Date().toISOString(),
        status: "paused",
        total_seconds: elapsed,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activeSession", ticketId] }),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      await api.entities.TicketSession.update(activeSession.id, {
        paused_at: new Date().toISOString(),
        status: "active",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activeSession", ticketId] }),
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      await api.entities.TicketSession.update(activeSession.id, {
        ended_at: new Date().toISOString(),
        status: "ended",
        total_seconds: elapsed,
      });
      const startBR = toZonedTime(new Date(activeSession.started_at), TZ);
      const endBR = nowBR();
      onTimeComplete({
        date: fmtDate(startBR),
        start_time: fmtTime(startBR),
        end_time: fmtTime(endBR),
        total_seconds: elapsed,
      });
    },
    onSuccess: () => {
      setElapsed(0);
      queryClient.invalidateQueries({ queryKey: ["activeSession", ticketId] });
    },
  });

  const isActive = activeSession?.status === "active";
  const isPaused = activeSession?.status === "paused";

  // Idle state — big start button
  if (!activeSession) {
    return (
      <button
        onClick={() => startMutation.mutate()}
        disabled={startMutation.isPending}
        className="w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/80 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 flex items-center justify-center transition-all">
          <Play className="w-5 h-5 text-emerald-500 ml-0.5" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-emerald-500">Iniciar Cronômetro</p>
          <p className="text-xs text-muted-foreground">Clique para começar a contar o tempo</p>
        </div>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border transition-all ${isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <div className="flex items-center gap-4 p-4">
        {/* Timer display */}
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
            <Timer className={`w-5 h-5 ${isActive ? "text-emerald-500" : "text-amber-500"}`} />
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-widest font-semibold mb-0.5 ${isActive ? "text-emerald-500/70" : "text-amber-500/70"}`}>
              {isActive ? "Em andamento" : "Pausado"}
            </p>
            <p className={`text-3xl font-bold font-mono leading-none ${isActive ? "text-emerald-500" : "text-amber-500"}`}>
              {formatTime(elapsed)}
            </p>
          </div>
          {isActive && (
            <div className="ml-2 flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1 rounded-full bg-emerald-500/50 animate-pulse"
                  style={{ height: 8 + (i * 4), animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isActive ? (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all"
            >
              <Pause className="w-3.5 h-3.5" />
              Pausar
            </button>
          ) : (
            <button
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Retomar
            </button>
          )}
          <button
            onClick={() => endMutation.mutate()}
            disabled={endMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Usar tempo
          </button>
          <button
            onClick={async () => {
              await api.entities.TicketSession.update(activeSession.id, { status: "ended", ended_at: new Date().toISOString() });
              setElapsed(0);
              queryClient.invalidateQueries({ queryKey: ["activeSession", ticketId] });
            }}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Descartar"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}