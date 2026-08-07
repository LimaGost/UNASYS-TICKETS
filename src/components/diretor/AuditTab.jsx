import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChartCard from "./ChartCard";

const TYPE_LABELS = {
  creation: { label: "Criação", color: "#22c55e" },
  status_change: { label: "Mudança de Status", color: "#8b5cf6" },
  time_entry: { label: "Apontamento", color: "#06b6d4" },
  comment_internal: { label: "Comentário Interno", color: "#94a3b8" },
  comment_client: { label: "Comentário Cliente", color: "#94a3b8" },
  assignment: { label: "Atribuição", color: "#f59e0b" },
  field_change: { label: "Alteração de Campo", color: "#f97316" },
  escalation: { label: "Escalonamento", color: "#ef4444" },
};

export default function AuditTab({ data }) {
  const { events, ticketById } = data;
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [limite, setLimite] = useState(50);

  const filtrados = useMemo(() => events.filter(e => {
    if (tipo !== "todos" && e.type !== tipo) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const t = ticketById[e.ticket_id];
      const alvo = `${e.description || ""} ${e.user_name || ""} ${e.user_email || ""} ${e.old_value || ""} ${e.new_value || ""} ${t?.title || ""} ${t?.client_name || ""} ${t?.ticket_number || ""}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  }), [events, tipo, busca, ticketById]);

  return (
    <ChartCard icon={ScrollText} title="Auditoria Completa" subtitle={`${filtrados.length} registros no período — toda alteração gera histórico`}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição, usuário, ticket, cliente..." className="h-8 pl-8 text-xs" />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 text-xs w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
      ) : (
        <div className="space-y-1.5">
          {filtrados.slice(0, limite).map(ev => {
            const t = ticketById[ev.ticket_id];
            const meta = TYPE_LABELS[ev.type] || { label: ev.type, color: "#94a3b8" };
            return (
              <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                  style={{ background: `${meta.color}22`, color: meta.color }}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground">{ev.description}</div>
                  {(ev.old_value || ev.new_value) && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ev.old_value && <span className="line-through mr-1.5">{ev.old_value}</span>}
                      {ev.new_value && <span className="text-foreground font-medium">→ {ev.new_value}</span>}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    <strong>{ev.user_name || ev.user_email || "Sistema"}</strong>
                    {" · "}{new Date(ev.created_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {t && <span> · #{t.ticket_number || t.id.slice(0, 6)} — {t.client_name || t.title?.slice(0, 30)}</span>}
                  </div>
                </div>
                {t && (
                  <Link to={`/ticket/${t.id}`} className="text-[11px] text-primary flex items-center gap-0.5 hover:underline flex-shrink-0 mt-0.5">
                    Ver <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            );
          })}
          {filtrados.length > limite && (
            <button onClick={() => setLimite(l => l + 50)}
              className="w-full text-xs text-primary hover:underline py-2">
              Carregar mais ({filtrados.length - limite} restantes)
            </button>
          )}
        </div>
      )}
    </ChartCard>
  );
}