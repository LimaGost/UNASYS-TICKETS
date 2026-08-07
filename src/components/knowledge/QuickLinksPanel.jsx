import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Link2, ExternalLink, Pencil, Trash2, X, Globe, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = { title: "", url: "", description: "", category: "", vertical: "", icon: "🔗" };

export default function QuickLinksPanel({ verticals = [] }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterVertical, setFilterVertical] = useState("all");
  const [viewLink, setViewLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: links = [] } = useQuery({
    queryKey: ["quickLinks"],
    queryFn: () => api.entities.QuickLink.filter({ active: true }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        await api.entities.QuickLink.update(editing.id, data);
      } else {
        await api.entities.QuickLink.create({ ...data, active: true });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(["quickLinks"]);
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? "Link atualizado!" : "Link criado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.QuickLink.update(id, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries(["quickLinks"]);
      toast.success("Link removido!");
    },
  });

  const handleOpen = (link = null) => {
    setEditing(link);
    setForm(link ? { title: link.title, url: link.url, description: link.description || "", category: link.category || "", vertical: link.vertical || "", icon: link.icon || "🔗" } : EMPTY_FORM);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.url) return toast.error("Título e URL são obrigatórios");
    saveMutation.mutate(form);
  };

  const filtered = filterVertical === "all" ? links : links.filter(l => l.vertical === filterVertical);

  // Group by category
  const groups = filtered.reduce((acc, link) => {
    const key = link.category || "Geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(link);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Select value={filterVertical} onValueChange={setFilterVertical}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Verticais</SelectItem>
            {verticals.filter(v => v.active).map(v => (
              <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => handleOpen()} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Link
        </Button>
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
        <Link2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum link cadastrado</p>
        <p className="text-xs mt-1">Adicione links úteis para o dia a dia da equipe</p>
        </div>
      )}

      {/* Groups */}
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map(link => {
              const v = verticals.find(vt => vt.code === link.vertical);
              return (
                <div
                  key={link.id}
                  onClick={() => setViewLink(link)}
                  className="group relative flex flex-col gap-2 p-4 rounded-xl border border-border hover:border-primary/40 transition-all cursor-pointer bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{link.icon || "🔗"}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{link.title}</p>
                        {v && (
                          <Badge className="text-[10px] mt-0.5 px-1.5 py-0" style={{ background: (v.color || "#8B5CF6") + "20", color: v.color || "#A78BFA", border: `1px solid ${v.color || "#8B5CF6"}30` }}>
                            {v.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleOpen(link); }} className="p-1 text-muted-foreground hover:text-primary">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(link.id); }} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {link.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{link.description}</p>}
                  <p className="mt-auto text-[11px] text-muted-foreground/60 truncate font-mono">{link.url}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* View Detail Modal */}
      <Dialog open={!!viewLink} onOpenChange={() => setViewLink(null)}>
        <DialogContent className="max-w-lg">
          {viewLink && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{viewLink.icon || "🔗"}</span>
                  <div>
                    <DialogTitle className="text-foreground text-lg">{viewLink.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {viewLink.category && (
                        <span className="text-[11px] text-muted-foreground">{viewLink.category}</span>
                      )}
                      {viewLink.vertical && (() => {
                        const v = verticals.find(vt => vt.code === viewLink.vertical);
                        return v ? (
                          <Badge className="text-[10px] px-1.5 py-0" style={{ background: (v.color || "#8B5CF6") + "20", color: v.color || "#A78BFA", border: `1px solid ${v.color || "#8B5CF6"}30` }}>
                            {v.name}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {viewLink.description && (
                <div className="p-4 bg-muted rounded-xl border border-border">
                  <p className="text-muted-foreground text-sm leading-relaxed">{viewLink.description}</p>
                </div>
              )}

              {/* URL Block */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">URL</label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border group">
                  <p className="flex-1 text-sm text-primary font-mono break-all leading-relaxed">{viewLink.url}</p>
                  <button
                    onClick={() => handleCopyUrl(viewLink.url)}
                    className="flex-shrink-0 p-2 rounded-lg transition-all hover:bg-primary/10"
                    title="Copiar URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400 hover:text-[#A78BFA]" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleCopyUrl(viewLink.url)}
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  Copiar URL
                </Button>
                <a
                  href={viewLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Abrir no Navegador
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Modal */}
      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">{editing ? "Editar Link" : "Novo Link Útil"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-5 gap-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Ícone</label>
                <Input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} className="text-center text-xl" maxLength={2} />
              </div>
              <div className="col-span-4 space-y-2">
                <label className="text-xs text-muted-foreground">Título *</label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Portal do Cliente" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">URL *</label>
              <Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Para que serve este link?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Sistemas, RH..." />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Vertical</label>
                <Select value={form.vertical || "none"} onValueChange={v => setForm(p => ({ ...p, vertical: v === "none" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas</SelectItem>
                    {verticals.filter(v => v.active).map(v => (
                      <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? "Salvar" : "Criar Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}