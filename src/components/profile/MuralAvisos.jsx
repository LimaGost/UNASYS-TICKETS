import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pin, Trash2, Plus, Megaphone, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CORES = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#F97316"];

export default function MuralAvisos({ currentUser }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState("#8B5CF6");
  const isAdmin = currentUser?.role === "admin";

  const { data: avisos = [] } = useQuery({
    queryKey: ["avisos"],
    queryFn: () => api.entities.Aviso.list("-created_date", 50),
  });

  const createMutation = useMutation({
    mutationFn: () => api.entities.Aviso.create({
      texto,
      cor,
      autor_nome: currentUser?.full_name || "Usuário",
      autor_email: currentUser?.email || "",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avisos"] });
      toast.success("Aviso publicado!");
      setTexto("");
      setCor("#8B5CF6");
      setShowForm(false);
    },
    onError: () => toast.error("Erro ao publicar aviso."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Aviso.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avisos"] });
      toast.success("Aviso removido.");
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }) => api.entities.Aviso.update(id, { pinned: !pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["avisos"] }),
  });

  const sorted = [...avisos].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const canDelete = (aviso) => isAdmin || aviso.autor_email === currentUser?.email;

  return (
    <div className="space-y-3">
      {/* Form de novo aviso */}
      {showForm ? (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
          <Textarea
            placeholder="Digite seu aviso..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="resize-none h-20 text-sm"
            autoFocus
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${cor === c ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/30 scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setTexto(""); }} className="h-7 px-2">
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!texto.trim() || createMutation.isPending} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Publicar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Plus className="w-4 h-4" /> Publicar aviso para todos...
        </button>
      )}

      {/* Lista de avisos */}
      {sorted.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Nenhum aviso no momento.</p>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        {sorted.map((aviso) => (
          <div
            key={aviso.id}
            className="rounded-xl p-3.5 border relative group"
            style={{
              borderColor: (aviso.cor || "#8B5CF6") + "40",
              borderLeftWidth: 3,
              borderLeftColor: aviso.cor || "#8B5CF6",
              background: (aviso.cor || "#8B5CF6") + "08",
            }}
          >
            {aviso.pinned && (
              <Pin className="w-3 h-3 absolute top-2.5 right-8 text-muted-foreground" />
            )}

            <p className="text-sm text-foreground leading-relaxed pr-6">{aviso.texto}</p>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: aviso.cor || "#8B5CF6" }}>
                  {(aviso.autor_nome || "?")[0]?.toUpperCase()}
                </span>
                <span className="text-[11px] text-muted-foreground">{aviso.autor_nome}</span>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(aviso.created_date), { addSuffix: true, locale: ptBR })}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isAdmin && (
                  <button
                    onClick={() => pinMutation.mutate({ id: aviso.id, pinned: aviso.pinned })}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${aviso.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title={aviso.pinned ? "Desafixar" : "Fixar"}
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                )}
                {canDelete(aviso) && (
                  <button
                    onClick={() => deleteMutation.mutate(aviso.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    title="Remover aviso"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}