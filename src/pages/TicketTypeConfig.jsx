import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "../components/ui/SearchableSelect";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Wrench, Ticket, ChevronDown, ChevronRight } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TicketTypeConfig() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [expandedVerticals, setExpandedVerticals] = useState({});

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticketTypes"],
    queryFn: () => api.entities.TicketType.list(),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const activeVerticals = verticals.filter(v => v.active !== false);

  // TicketType mutations
  const saveMutation = useMutation({
    mutationFn: ({ id, ...data }) => {
      if (id) return api.entities.TicketType.update(id, data);
      return api.entities.TicketType.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketTypes"] });
      setShowDialog(false);
      setEditing(null);
      toast.success("Tipo de ticket salvo!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.TicketType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketTypes"] });
      toast.success("Tipo removido!");
    },
  });

  // ServiceType mutations
  const saveServiceMutation = useMutation({
    mutationFn: ({ id, ...data }) => {
      if (id) return api.entities.ServiceType.update(id, data);
      return api.entities.ServiceType.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceTypes"] });
      setShowServiceDialog(false);
      setEditingService(null);
      toast.success("Tipo de serviço salvo!");
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id) => api.entities.ServiceType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceTypes"] });
      toast.success("Serviço removido!");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return toast.error("Nome é obrigatório");
    if (!editing?.vertical) return toast.error("Selecione a vertical");
    saveMutation.mutate(editing);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const data = { ...editingService };
    if (!data.name?.trim()) return toast.error("Nome é obrigatório");
    if (data.ticket_type === "__all__") data.ticket_type = "";
    if (data.vertical === "__all__") data.vertical = "";
    saveServiceMutation.mutate(data);
  };

  const startNew = (verticalCode = "") => {
    setEditing({ name: "", vertical: verticalCode, duration_unit: "hours", default_sla_hours: 24, color: "#8B5CF6", active: true, main_type: "implantacao" });
    setShowDialog(true);
  };

  const startEdit = (type) => {
    setEditing({ ...type });
    setShowDialog(true);
  };

  const startNewService = (ticketTypeName = "", verticalCode = "") => {
    setEditingService({ name: "", ticket_type: ticketTypeName, vertical: verticalCode, active: true });
    setShowServiceDialog(true);
  };

  const startEditService = (st) => {
    setEditingService({ ...st });
    setShowServiceDialog(true);
  };

  const toggleVertical = (code) => {
    setExpandedVerticals(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const mainTypeLabel = { implantacao: "Implantação", chamado: "Implantação", suporte: "Suporte", implantação: "Implantação" };

  // Group ticket types by vertical (including types without vertical)
  const ticketTypesByVertical = activeVerticals.map(v => ({
    vertical: v,
    types: ticketTypes.filter(t => t.vertical === v.code),
  }));

  // Ticket types without a vertical — show in a generic group
  const typesWithoutVertical = ticketTypes.filter(t => !t.vertical);

  // Group service types by ticket_type and vertical
  // Services with empty vertical appear in all verticals for that ticket type
  const getServicesForType = (typeName, verticalCode) =>
    serviceTypes.filter(s => s.ticket_type === typeName && (!s.vertical || s.vertical === verticalCode));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos de Ticket e Serviços"
        subtitle="Configure os tipos de ticket por vertical e os serviços disponíveis em cada um"
      />

      <Tabs defaultValue="ticket-types">
        <TabsList>
          <TabsTrigger value="ticket-types">
            <Ticket className="w-4 h-4 mr-2" /> Tipos de Ticket
          </TabsTrigger>
          <TabsTrigger value="service-types">
            <Wrench className="w-4 h-4 mr-2" /> Serviços Avulsos
          </TabsTrigger>
        </TabsList>

        {/* TICKET TYPES TAB — grouped by vertical */}
        <TabsContent value="ticket-types" className="mt-4 space-y-4">
          {/* Types without vertical */}
          {typesWithoutVertical.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-muted/40">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">Sem vertical definida</span>
                  <Badge variant="outline" className="text-xs">{typesWithoutVertical.length} tipo{typesWithoutVertical.length !== 1 ? "s" : ""}</Badge>
                </div>
              </div>
              <div className="border-t border-border divide-y divide-border">
                {typesWithoutVertical.map(type => {
                  const services = serviceTypes.filter(s => s.ticket_type === type.name);
                  return (
                    <div key={type.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                          <div>
                            <span className="text-foreground font-medium">{type.name}</span>
                            <span className="text-muted-foreground text-xs ml-3">{type.default_sla_hours}h SLA</span>
                          </div>
                          <Badge className={type.main_type === "suporte"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                            : "bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/30 text-xs"}>
                            {mainTypeLabel[type.main_type] || "Implantação"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => startEdit(type)}>Editar</Button>
                          <Button size="sm" variant="ghost"
                            className="h-7 text-red-400 hover:text-red-300"
                            onClick={() => deleteMutation.mutate(type.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="ml-5 mt-2 space-y-1">
                        {services.map(svc => (
                           <div key={svc.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-1.5">
                             <span className="text-muted-foreground text-sm">{svc.name}</span>
                             <div className="flex items-center gap-1">
                               <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                                 onClick={() => startEditService(svc)}>Editar</Button>
                              <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:text-red-300 px-2"
                                onClick={() => deleteServiceMutation.mutate(svc.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost"
                          className="h-7 text-xs text-primary gap-1 pl-0"
                          onClick={() => startNewService(type.name, "")}>
                          <Plus className="w-3 h-3" /> Adicionar serviço
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ticketTypesByVertical.map(({ vertical, types }) => {
            const isOpen = expandedVerticals[vertical.code] !== false;
            return (
              <div key={vertical.code} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Vertical header */}
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleVertical(vertical.code)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vertical.color || "#8B5CF6" }} />
                    <span className="font-semibold text-foreground">{vertical.name}</span>
                    <Badge variant="outline" className="text-xs">{types.length} tipo{types.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-1 h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); startNew(vertical.code); }}
                    >
                      <Plus className="w-3 h-3" /> Novo Tipo
                    </Button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Types list */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {types.length === 0 && (
                      <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum tipo cadastrado para esta vertical.</p>
                    )}
                    {types.map(type => {
                      const services = getServicesForType(type.name, vertical.code);
                      return (
                        <div key={type.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                              <div>
                                <span className="text-foreground font-medium">{type.name}</span>
                                <span className="text-muted-foreground text-xs ml-3">{type.default_sla_hours}h SLA</span>
                              </div>
                              <Badge className={type.main_type === "suporte"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                                : "bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/30 text-xs"}>
                                {mainTypeLabel[type.main_type] || "Implantação"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => startEdit(type)}>
                                Editar
                              </Button>
                              <Button size="sm" variant="ghost"
                                className="h-7 text-red-400 hover:text-red-300"
                                onClick={() => deleteMutation.mutate(type.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Services under this ticket type */}
                          <div className="ml-5 mt-2 space-y-1">
                            {services.map(svc => (
                              <div key={svc.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-1.5">
                                <span className="text-muted-foreground text-sm">{svc.name}</span>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                                    onClick={() => startEditService(svc)}>Editar</Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:text-red-300 px-2"
                                    onClick={() => deleteServiceMutation.mutate(svc.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-primary gap-1 pl-0"
                              onClick={() => startNewService(type.name, vertical.code)}>
                              <Plus className="w-3 h-3" /> Adicionar serviço
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* SERVICE TYPES TAB — serviços sem vínculo específico ou avulsos */}
        <TabsContent value="service-types" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Serviços que aparecem em todos os tipos de ticket (sem vínculo específico)</p>
            <Button onClick={() => startNewService("", "")} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
              <Plus className="w-4 h-4" /> Novo Serviço Avulso
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {serviceTypes.filter(s => !s.ticket_type).map(st => (
              <div key={st.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                <div>
                  <p className="text-foreground font-medium">{st.name}</p>
                  {st.vertical && (
                    <Badge variant="outline" className="text-xs text-gray-400 mt-1">
                      {verticals.find(v => v.code === st.vertical)?.name || st.vertical}
                    </Badge>
                  )}
                  {!st.vertical && <p className="text-muted-foreground text-xs">Todas as verticais</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => startEditService(st)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:text-red-300"
                    onClick={() => deleteServiceMutation.mutate(st.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {serviceTypes.filter(s => !s.ticket_type).length === 0 && (
              <p className="text-muted-foreground text-sm col-span-2">Nenhum serviço avulso cadastrado.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Ticket Type Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} Tipo de Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Nome *</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing({...editing, name: e.target.value})}
                placeholder="Ex: Implantação, Consultoria..." required />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Vertical *</Label>
              <SearchableSelect
                value={editing?.vertical || ""}
                onValueChange={(v) => setEditing({...editing, vertical: v})}
                options={activeVerticals.map(v => ({ value: v.code, label: v.name }))}
                placeholder="Selecione a vertical"
                searchPlaceholder="Buscar vertical..."
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Módulo do sistema *</Label>
              <SearchableSelect
                value={editing?.main_type || "implantacao"}
                onValueChange={(v) => setEditing({...editing, main_type: v})}
                options={[{ value: "implantacao", label: "Implantação" }, { value: "suporte", label: "Suporte" }]}
                placeholder="Selecione"
                searchPlaceholder="Buscar..."
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">SLA Padrão (horas)</Label>
              <Input type="number" value={editing?.default_sla_hours || ""} onChange={(e) => setEditing({...editing, default_sla_hours: parseFloat(e.target.value)})} />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Cor</Label>
              <Input type="color" value={editing?.color || "#8B5CF6"} onChange={(e) => setEditing({...editing, color: e.target.value})}
                className="h-9 w-16" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit" className="gap-2">
                <Save className="w-4 h-4" /> Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Service Type Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService?.id ? "Editar" : "Novo"} Tipo de Serviço</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleServiceSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Nome *</Label>
              <Input value={editingService?.name || ""} onChange={(e) => setEditingService({...editingService, name: e.target.value})}
                placeholder="Ex: Microvix Go, Microvix Full..." required />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Tipo de Ticket vinculado</Label>
              <SearchableSelect
                value={editingService?.ticket_type || "__all__"}
                onValueChange={(v) => setEditingService({...editingService, ticket_type: v === "__all__" ? "" : v})}
                options={[
                  { value: "__all__", label: "Sem vínculo (aparece em todos)" },
                  ...ticketTypes.filter(t => t.active !== false).map(t => ({
                    value: t.name,
                    label: t.name + (t.vertical ? ` (${activeVerticals.find(v => v.code === t.vertical)?.name || t.vertical})` : "")
                  }))
                ]}
                placeholder="Sem vínculo (aparece em todos)"
                searchPlaceholder="Buscar tipo..."
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Vertical</Label>
              <SearchableSelect
                value={editingService?.vertical || "__all__"}
                onValueChange={(v) => setEditingService({...editingService, vertical: v === "__all__" ? "" : v})}
                options={[
                  { value: "__all__", label: "Todas as verticais" },
                  ...activeVerticals.map(v => ({ value: v.code, label: v.name }))
                ]}
                placeholder="Todas as verticais"
                searchPlaceholder="Buscar vertical..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowServiceDialog(false)}>Cancelar</Button>
              <Button type="submit" className="gap-2">
                <Save className="w-4 h-4" /> Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}