import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Bell, Check, X, ExternalLink, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

const TYPE_CONFIG = {
  ticket_assigned:  { icon: "👤", label: "Atribuição",    color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/30"   },
  status_changed:   { icon: "🔄", label: "Status",        color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  new_comment:      { icon: "💬", label: "Comentário",    color: "text-green-500",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
  new_time_entry:   { icon: "⏱️", label: "Apontamento",   color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  mentioned:        { icon: "📌", label: "Menção",        color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  sla_warning:      { icon: "🚨", label: "SLA",           color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  ticket_created:   { icon: "✨", label: "Novo ticket",   color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/30"    },
  email_reply:      { icon: "📧", label: "E-mail",        color: "text-cyan-500",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30"   },
};

function timeAgo(date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const prevUnreadCount = useRef(-1); // -1 = primeira carga, não dispara toast
  const panelRef = useRef(null);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const all = await api.entities.Notification.filter({ user_email: currentUser.email });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => api.entities.Notification.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => api.entities.Notification.update(n.id, { read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteAllReadMutation = useMutation({
    mutationFn: async () => {
      const read = notifications.filter(n => n.read);
      await Promise.all(read.map(n => api.entities.Notification.delete(n.id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const triggerNew = useCallback((notifData) => {
    playNotificationSound();
    setRinging(true);
    setTimeout(() => setRinging(false), 1200);
    const cfg = TYPE_CONFIG[notifData?.type] || { icon: "🔔" };
    toast(notifData?.title || "Nova notificação", {
      description: notifData?.message,
      icon: cfg.icon,
      duration: 5000,
    });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(notifData?.title || "Nova notificação", {
        body: notifData?.message,
        icon: "/favicon.ico",
      });
    }
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = api.entities.Notification.subscribe((event) => {
      if (event.type === "create" && event.data?.user_email === currentUser.email) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        triggerNew(event.data);
      }
    });
    return unsubscribe;
  }, [currentUser, triggerNew, queryClient]);

  // Detecta novas notificações via polling
  useEffect(() => {
    const currentUnread = notifications.filter(n => !n.read).length;
    // -1 = primeira carga, apenas inicializa sem disparar toast
    if (prevUnreadCount.current === -1) {
      prevUnreadCount.current = currentUnread;
      return;
    }
    if (currentUnread > prevUnreadCount.current) {
      const newest = notifications.find(n => !n.read);
      triggerNew(newest);
    }
    prevUnreadCount.current = currentUnread;
  }, [notifications, triggerNew]);

  // Request browser permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  if (!currentUser) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        aria-label="Notificações"
      >
        <Bell
          className={`w-[18px] h-[18px] transition-all duration-200 ${ringing ? "scale-125" : ""}`}
          style={ringing ? { animation: "ring 0.3s ease-in-out 3" } : {}}
        />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-transform ${ringing ? "scale-125" : "scale-100"}`}
            style={{ background: unread.some(n => n.type === "sla_warning") ? "#ef4444" : "hsl(var(--primary))" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <style>{`
        @keyframes ring {
          0%   { transform: rotate(0deg);   }
          20%  { transform: rotate(-20deg); }
          40%  { transform: rotate(20deg);  }
          60%  { transform: rotate(-15deg); }
          80%  { transform: rotate(15deg);  }
          100% { transform: rotate(0deg);   }
        }
      `}</style>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-[200] flex flex-col rounded-xl border border-border shadow-2xl overflow-hidden"
          style={{ width: 400, background: "hsl(var(--card))", maxHeight: "85vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-primary">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Ler todas
                </button>
              )}
              {read.length > 0 && (
                <button
                  onClick={() => deleteAllReadMutation.mutate()}
                  disabled={deleteAllReadMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Limpar lidas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea style={{ flex: 1, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              </div>
            ) : (
              <div>
                {/* Unread section */}
                {unread.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                      Não lidas — {unread.length}
                    </div>
                    {unread.map(n => (
                      <NotifItem key={n.id} notif={n} onRead={markAsReadMutation.mutate} onDelete={deleteMutation.mutate} onClose={() => setOpen(false)} />
                    ))}
                  </div>
                )}

                {/* Read section */}
                {read.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                      Lidas
                    </div>
                    {read.slice(0, 20).map(n => (
                      <NotifItem key={n.id} notif={n} onRead={markAsReadMutation.mutate} onDelete={deleteMutation.mutate} onClose={() => setOpen(false)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border flex-shrink-0">
            <Link to="/NotificationSettings" onClick={() => setOpen(false)}>
              <button className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 text-center">
                Configurações de notificações
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ notif, onRead, onDelete, onClose }) {
  const cfg = TYPE_CONFIG[notif.type] || { icon: "🔔", color: "text-foreground", bg: "bg-muted", border: "border-border" };

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/40 ${!notif.read ? "bg-primary/[0.04]" : ""}`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 border ${cfg.bg} ${cfg.border}`}>
        {cfg.icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className={`text-[12px] font-semibold leading-tight ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
            {notif.title}
          </p>
          {/* Actions (visible on hover) */}
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notif.read && (
              <button
                onClick={(e) => { e.stopPropagation(); onRead(notif.id); }}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Marcar como lida"
              >
                <Check className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notif.message}
        </p>

        <div className="flex items-center justify-between mt-1.5 gap-2">
          <span className="text-[10px] text-muted-foreground/60">{timeAgo(notif.created_date)}</span>
          {notif.ticket_id && (
            <Link
              to={`/ticket/${notif.ticket_id}`}
              onClick={() => {
                onClose();
                if (!notif.read) onRead(notif.id);
              }}
              className={`text-[10px] font-medium flex items-center gap-0.5 transition-colors ${cfg.color} hover:opacity-70`}
            >
              Ver ticket <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}