import React, { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Pencil, Search, Building2, Phone, Users, CheckCircle2, Filter,
  History, Download, Upload, Map, Edit3, X, ChevronDown, CheckSquare,
  Square, MapPin, Loader2, AlertTriangle
} from "lucide-react";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";
import { createPageUrl } from "../utils";
import { verificarCNPJ, cnpjFormatado } from "../utils/cnpj";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import * as Leaflet from "leaflet";

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABELS = { novo_cliente: "Novo Cliente", cliente_da_base: "Base", parceiro: "Parceiro" };
const STATUS_COLORS = { novo_cliente: "#8B5CF6", cliente_da_base: "#3B82F6", parceiro: "#10B981" };
const CONTRATO_LABELS = { ativo: "Ativo", cancelado: "Cancelado" };
const SEGMENTOS = ["suporti", "bsb", "farma", "foda", "outros"];

const emptyForm = {
  nome_fantasia: "", empresa: "", nome: "", email: "",
  cnpj: "", cnae: "", marca: "", grupo_economico: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "",
  telefone: "", telefone2: "", telefone3: "",
  status: "novo_cliente", status_contrato: "ativo",
  colaborador_responsavel_id: "", vertical_ids: [],
  segmento: "", lista_origem: "", td_identificado: false,
  concorrentes: [], notes: "", active: true,
  // legado
  name: "", razao_social: "", phone: "", contact_person: "", vertical: "",
};

// ── CSV Export (xlsx-like as CSV) ─────────────────────────────────────────────
function exportToCSV(clients, verticals, colaboradores) {
  const headers = ["Nome Fantasia","Razão Social","Nome Contato","Email","CNPJ","CNAE","Marca","Grupo Econômico",
    "CEP","Logradouro","Número","Complemento","Bairro","Município","UF","Telefone","Telefone2","Telefone3",
    "Status","Status Contrato","Segmento","TD Identificado","Lista Origem","Vertical","Responsável","Observações"];
  const vMap = Object.fromEntries(verticals.map(v => [v.id, v.name]));
  const cMap = Object.fromEntries(colaboradores.map(c => [c.id, c.nome]));
  const rows = clients.map(c => [
    c.nome_fantasia || c.name || "",
    c.empresa || c.razao_social || "",
    c.nome || c.contact_person || "",
    c.email || "",
    c.cnpj || "",
    c.cnae || "",
    c.marca || "",
    c.grupo_economico || "",
    c.cep || "", c.logradouro || "", c.numero || "", c.complemento || "", c.bairro || "", c.municipio || "", c.uf || "",
    c.telefone || c.phone || "",
    c.telefone2 || "",
    c.telefone3 || "",
    STATUS_LABELS[c.status] || c.status || "",
    CONTRATO_LABELS[c.status_contrato] || "",
    c.segmento || "",
    c.td_identificado ? "Sim" : "Não",
    c.lista_origem || "",
    (c.vertical_ids || []).map(id => vMap[id] || id).join("; ") || c.vertical || "",
    cMap[c.colaborador_responsavel_id] || "",
    c.notes || "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "clientes.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── CSV Import parser ─────────────────────────────────────────────────────────
function parseCSVImport(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const map = {
    nome_fantasia: ["nome_fantasia","nome fantasia","fantasia","name"],
    empresa: ["empresa","razao_social","razão social","razao social"],
    nome: ["nome","contato","contact_person","pessoa de contato"],
    email: ["email","e-mail"],
    cnpj: ["cnpj"],
    cnae: ["cnae"],
    telefone: ["telefone","phone","fone"],
    telefone2: ["telefone2","fone2"],
    uf: ["uf","estado"],
    municipio: ["municipio","município","cidade"],
    cep: ["cep"],
    logradouro: ["logradouro","endereco","endereço"],
    bairro: ["bairro"],
    status: ["status"],
    segmento: ["segmento"],
    lista_origem: ["lista_origem","lista origem","origem"],
  };
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    Object.entries(map).forEach(([key, aliases]) => {
      const idx = headers.findIndex(h => aliases.includes(h));
      if (idx >= 0 && vals[idx]) row[key] = vals[idx];
    });
    if (!row.nome_fantasia && vals[0]) row.nome_fantasia = vals[0];
    return row;
  }).filter(r => r.nome_fantasia);
}

// ── Geocode via Nominatim ─────────────────────────────────────────────────────
async function geocodeAddress(client) {
  const q = [client.logradouro, client.numero, client.bairro, client.municipio, client.uf].filter(Boolean).join(", ");
  if (!q) return null;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=br&limit=1`, {
    headers: { "Accept-Language": "pt-BR" }
  });
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
export default function Clients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterVertical, setFilterVertical] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterContrato, setFilterContrato] = useState("all");
  const [visibleCount, setVisibleCount] = useState(50);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({ status: "", status_contrato: "", colaborador_responsavel_id: "", vertical_ids: [] });
  const [showMap, setShowMap] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const fileRef = useRef();

  const { data: allClients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => api.entities.Client.list() });
  const { data: verticals = [] } = useQuery({ queryKey: ["verticals"], queryFn: () => api.entities.Vertical.list() });
  const { data: colaboradores = [] } = useQuery({ queryKey: ["colaboradores"], queryFn: () => api.entities.Colaborador.list() });
  const { userVertical, canAccessAllVerticals } = useVerticalFilter();

  const clients = allClients.filter(c => canAccessAllVerticals || !userVertical || c.vertical === userVertical);
  const activeVerticals = verticals.filter(v => v.active !== false);
  const activeColaboradores = colaboradores.filter(c => c.status !== "inativo");

  const filtered = useMemo(() => clients.filter(c => {
    const nome = c.nome_fantasia || c.name || "";
    const matchSearch = !search || nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.cnpj || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.empresa || c.razao_social || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.municipio || "").toLowerCase().includes(search.toLowerCase());
    const matchV = filterVertical === "all" || (c.vertical_ids || []).includes(filterVertical) || c.vertical === filterVertical;
    const matchS = filterStatus === "all" || c.status === filterStatus;
    const matchC = filterContrato === "all" || c.status_contrato === filterContrato ||
      (filterContrato === "ativo" && !c.status_contrato) ||
      (filterContrato === "ativo" && c.active !== false);
    return matchSearch && matchV && matchS && matchC;
  }), [clients, search, filterVertical, filterStatus, filterContrato]);

  const [cnpjErro, setCnpjErro] = useState(null);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cnpjCheck = verificarCNPJ(data.cnpj);
      if (!cnpjCheck.valido) throw new Error(cnpjCheck.erro);
      const payload = {
        ...data,
        cnpj: cnpjCheck.formatado,
        name: data.nome_fantasia || data.name,
        razao_social: data.empresa || data.razao_social
      };
      if (editing) await api.entities.Client.update(editing.id, payload);
      else await api.entities.Client.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowForm(false); setEditing(null); setForm(emptyForm); setCnpjErro(null);
      toast({ title: "Cliente salvo com sucesso", duration: 3000 });
    },
    onError: (err) => {
      if (err.message?.includes("CNPJ")) setCnpjErro(err.message);
      else toast({ title: "Erro ao salvar", description: err.message, variant: "destructive", duration: 4000 });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const updates = [...selectedIds].map(id => {
        const patch = {};
        if (bulkForm.status) patch.status = bulkForm.status;
        if (bulkForm.status_contrato) patch.status_contrato = bulkForm.status_contrato;
        if (bulkForm.colaborador_responsavel_id) patch.colaborador_responsavel_id = bulkForm.colaborador_responsavel_id;
        return api.entities.Client.update(id, patch);
      });
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSelectedIds(new Set()); setShowBulkEdit(false);
      setBulkForm({ status: "", status_contrato: "", colaborador_responsavel_id: "", vertical_ids: [] });
      toast({ title: `${selectedIds.size} clientes atualizados` });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rows) => {
      await api.entities.Client.bulkCreate(rows.map(r => ({ ...r, active: true, status_contrato: r.status_contrato || "ativo" })));
    },
    onSuccess: (_, rows) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setImportPreview(null);
      toast({ title: `${rows.length} clientes importados com sucesso` });
    },
  });

  const openEdit = (client) => {
    setEditing(client);
    setForm({ ...emptyForm, ...client, nome_fantasia: client.nome_fantasia || client.name || "", empresa: client.empresa || client.razao_social || "" });
    setShowForm(true);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSVImport(ev.target.result);
      setImportPreview(rows);
      setImporting(false);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleGeocode = async () => {
    const toGeocode = clients.filter(c => c.logradouro && !c.lat);
    if (!toGeocode.length) { toast({ title: "Nenhum cliente sem coordenadas" }); return; }
    setGeocoding(true);
    let count = 0;
    for (const c of toGeocode.slice(0, 20)) {
      const coords = await geocodeAddress(c);
      if (coords) { await api.entities.Client.update(c.id, coords); count++; }
      await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    }
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setGeocoding(false);
    toast({ title: `${count} endereços geocodificados` });
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const resetVisible = () => setVisibleCount(50);
  const geocodedCount = clients.filter(c => c.lat && c.lng).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            Clientes
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5 ml-11">Base de clientes e relacionamentos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowMap(true)} className="gap-1.5 h-9">
            <Map className="w-4 h-4" /> Mapa ({geocodedCount})
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 h-9" disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importar CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, verticals, colaboradores)} className="gap-1.5 h-9">
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }} className="gap-1.5 h-9">
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: clients.length, icon: Users, color: "#8B5CF6" },
          { label: "Ativos (contrato)", value: clients.filter(c => c.status_contrato !== "cancelado").length, icon: CheckCircle2, color: "#10B981" },
          { label: "Novos Clientes", value: clients.filter(c => c.status === "novo_cliente").length, icon: Plus, color: "#3B82F6" },
          { label: "TD Identificado", value: clients.filter(c => c.td_identificado).length, icon: CheckSquare, color: "#F59E0B" },
        ].map(({ label, value, icon: KpiIcon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3"
            style={{ borderColor: color + "30" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
              <KpiIcon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk edit bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
          <Button size="sm" variant="outline" onClick={() => setShowBulkEdit(true)} className="gap-1.5 h-8 text-xs">
            <Edit3 className="w-3.5 h-3.5" /> Editar em massa
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs gap-1">
            <X className="w-3.5 h-3.5" /> Limpar seleção
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); resetVisible(); }} placeholder="Nome, CNPJ, e-mail, município..." className="pl-10 h-9" />
        </div>
        <Select value={filterVertical} onValueChange={v => { setFilterVertical(v); resetVisible(); }}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Vertical" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Verticais</SelectItem>
            {activeVerticals.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); resetVisible(); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterContrato} onValueChange={v => { setFilterContrato(v); resetVisible(); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Contrato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Contratos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        {(filterVertical !== "all" || filterStatus !== "all" || filterContrato !== "all" || search) && (
          <button onClick={() => { setFilterVertical("all"); setFilterStatus("all"); setFilterContrato("all"); setSearch(""); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpar filtros</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""} {filtered.length > visibleCount ? `(mostrando ${visibleCount})` : ""}</span>
          {filtered.length > 0 && (
            <button onClick={toggleSelectAll} className="text-xs text-primary hover:underline">
              {selectedIds.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome Fantasia</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa / CNPJ</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Localização</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vertical</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contrato</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, visibleCount).map(c => {
              const nomef = c.nome_fantasia || c.name || "—";
              const empresa = c.empresa || c.razao_social || "";
              const tel = c.telefone || c.phone || "";
              const loc = [c.municipio, c.uf].filter(Boolean).join(" / ");
              const statusColor = STATUS_COLORS[c.status] || "#6B7280";
              const isSelected = selectedIds.has(c.id);
              return (
                <TableRow key={c.id}
                  className={`border-border hover:bg-muted/40 cursor-pointer transition-colors group ${isSelected ? "bg-primary/5" : ""}`}>
                  <TableCell className="py-2.5 pl-4">
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                      className="text-muted-foreground hover:text-primary transition-colors">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="py-2.5" onClick={() => openEdit(c)}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: statusColor + "18" }}>
                        <Building2 className="w-4 h-4" style={{ color: statusColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate max-w-[160px]">{nomef}</p>
                        {c.marca && <p className="text-[10px] text-muted-foreground">{c.marca}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground" onClick={() => openEdit(c)}>
                    <p className="truncate max-w-[150px]">{empresa || "—"}</p>
                    {c.cnpj && <p className="text-[10px] font-mono">{c.cnpj}</p>}
                  </TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground" onClick={() => openEdit(c)}>
                    {loc ? (
                      <span className="flex items-center gap-1">
                        {c.lat && <MapPin className="w-3 h-3 text-green-400 flex-shrink-0" />}
                        {loc}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="py-2.5" onClick={() => openEdit(c)}>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {(c.nome || c.contact_person) && <p className="truncate max-w-[120px]">{c.nome || c.contact_person}</p>}
                      {tel && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{tel}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5" onClick={() => openEdit(c)}>
                    <div className="flex flex-wrap gap-1">
                      {(c.vertical_ids || []).length > 0
                        ? (c.vertical_ids || []).map(vid => {
                            const v = activeVerticals.find(av => av.id === vid);
                            return v ? (
                              <span key={vid} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: (v.color || "#8B5CF6") + "20", color: v.color || "#8B5CF6" }}>
                                {v.name}
                              </span>
                            ) : null;
                          })
                        : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5" onClick={() => openEdit(c)}>
                    <Badge className="text-[10px] px-2 py-0.5 border-0 font-semibold"
                      style={{ background: statusColor + "20", color: statusColor }}>
                      {STATUS_LABELS[c.status] || c.status || "—"}
                    </Badge>
                    {c.td_identificado && (
                      <Badge className="mt-1 block w-fit text-[9px] px-1.5 py-0.5 border-0 bg-amber-500/15 text-amber-500">TD ✓</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5" onClick={() => openEdit(c)}>
                    <Badge className={`text-[10px] px-2 py-0.5 border-0 ${c.status_contrato === "cancelado" ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"}`}>
                      {CONTRATO_LABELS[c.status_contrato] || "Ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} title="Editar">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                      <Link to={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} title="Histórico">
                        <History className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum cliente encontrado</p>
          </div>
        )}
        {filtered.length > visibleCount && (
          <div className="text-center py-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 50)}>
              Carregar mais 50 ({filtered.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5 mt-2">

            {/* Identificação */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Identificação Empresarial</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome Fantasia *</Label>
                  <Input value={form.nome_fantasia} onChange={e => set("nome_fantasia", e.target.value)} required className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Razão Social</Label>
                  <Input value={form.empresa} onChange={e => set("empresa", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    onChange={e => { set("cnpj", e.target.value); setCnpjErro(null); }}
                    onBlur={e => {
                      const { valido, formatado, erro } = verificarCNPJ(e.target.value);
                      if (valido) set("cnpj", formatado);
                      else if (e.target.value) setCnpjErro(erro);
                    }}
                    placeholder="00.000.000/0000-00"
                    className={`mt-1 ${cnpjErro ? "border-red-500" : ""}`}
                  />
                  {cnpjErro && <p className="text-xs text-red-500 mt-1">{cnpjErro}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CNAE</Label>
                  <Input value={form.cnae} onChange={e => set("cnae", e.target.value)} placeholder="0000-0/00" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Marca</Label>
                  <Input value={form.marca} onChange={e => set("marca", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Grupo Econômico</Label>
                  <Input value={form.grupo_economico} onChange={e => set("grupo_economico", e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contato</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome do Contato</Label>
                  <Input value={form.nome} onChange={e => set("nome", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <Input value={form.email} onChange={e => set("email", e.target.value)} type="email" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone 2</Label>
                  <Input value={form.telefone2} onChange={e => set("telefone2", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone 3</Label>
                  <Input value={form.telefone3} onChange={e => set("telefone3", e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Endereço</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">CEP</Label>
                  <Input value={form.cep} onChange={e => set("cep", e.target.value)} placeholder="00000-000" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Logradouro</Label>
                  <Input value={form.logradouro} onChange={e => set("logradouro", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Número</Label>
                  <Input value={form.numero} onChange={e => set("numero", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Complemento</Label>
                  <Input value={form.complemento} onChange={e => set("complemento", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bairro</Label>
                  <Input value={form.bairro} onChange={e => set("bairro", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Município</Label>
                  <Input value={form.municipio} onChange={e => set("municipio", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">UF</Label>
                  <Input value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} placeholder="SP" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Relacionamento */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Relacionamento</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status Contrato</Label>
                  <Select value={form.status_contrato} onValueChange={v => set("status_contrato", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Select value={form.colaborador_responsavel_id} onValueChange={v => set("colaborador_responsavel_id", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum</SelectItem>
                      {activeColaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Verticais</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {activeVerticals.map(v => {
                      const selected = (form.vertical_ids || []).includes(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            const current = form.vertical_ids || [];
                            set("vertical_ids", selected ? current.filter(id => id !== v.id) : [...current, v.id]);
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {v.name}
                        </button>
                      );
                    })}
                    {activeVerticals.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma vertical cadastrada</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Segmento</Label>
                  <Select value={form.segmento} onValueChange={v => set("segmento", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum</SelectItem>
                      {SEGMENTOS.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lista de Origem</Label>
                  <Input value={form.lista_origem} onChange={e => set("lista_origem", e.target.value)} className="mt-1" />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <input type="checkbox" id="td" checked={!!form.td_identificado} onChange={e => set("td_identificado", e.target.checked)} className="w-4 h-4 rounded" />
                  <Label htmlFor="td" className="text-sm text-muted-foreground cursor-pointer">TD (Tomador de Decisão) identificado</Label>
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">Concorrentes (um por linha)</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={(form.concorrentes || []).join("\n")}
                  onChange={e => set("concorrentes", e.target.value.split("\n").filter(Boolean))}
                  placeholder="Concorrente A&#10;Concorrente B"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="mt-1" rows={2} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Edit Modal ── */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edição em Massa — {selectedIds.size} clientes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">Preencha apenas os campos que deseja alterar. Campos em branco serão ignorados.</p>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={bulkForm.status} onValueChange={v => setBulkForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Não alterar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Não alterar</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status Contrato</Label>
              <Select value={bulkForm.status_contrato} onValueChange={v => setBulkForm(p => ({ ...p, status_contrato: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Não alterar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Não alterar</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select value={bulkForm.colaborador_responsavel_id} onValueChange={v => setBulkForm(p => ({ ...p, colaborador_responsavel_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Não alterar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Não alterar</SelectItem>
                  {activeColaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowBulkEdit(false)}>Cancelar</Button>
              <Button onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? "Salvando..." : "Aplicar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import Preview Modal ── */}
      <Dialog open={!!importPreview} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia da Importação — {importPreview?.length || 0} registros</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Verifique os dados antes de confirmar. A importação adicionará novos registros.
            </div>
            <div className="border border-border rounded-lg overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>{["Nome Fantasia","Empresa","CNPJ","E-mail","Município","Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(importPreview || []).slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-medium">{r.nome_fantasia}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.empresa || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.cnpj || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.municipio || "—"}</td>
                      <td className="px-3 py-1.5">{r.status || "novo_cliente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importPreview?.length > 50 && <p className="text-xs text-muted-foreground text-center">Mostrando 50 de {importPreview.length} registros</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setImportPreview(null)}>Cancelar</Button>
              <Button onClick={() => importMutation.mutate(importPreview)} disabled={importMutation.isPending}>
                {importMutation.isPending ? "Importando..." : `Importar ${importPreview?.length} registros`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Map Modal ── */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-semibold text-foreground">Mapa de Clientes</h3>
              <p className="text-xs text-muted-foreground">{geocodedCount} clientes com localização</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGeocode} disabled={geocoding} className="gap-1.5 h-8 text-xs">
              {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              {geocoding ? "Geocodificando..." : "Geocodificar endereços"}
            </Button>
          </div>
          <div className="flex-1 relative">
            <ClientMap clients={clients.filter(c => c.lat && c.lng)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Map component ────────────────────────────────────────────────────────────
function ClientMap({ clients }) {
  const icon = Leaflet.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#8B5CF6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  const center = clients.length > 0
    ? [clients[0].lat, clients[0].lng]
    : [-15.7942, -47.8825]; // Brasília fallback

  return (
    <MapContainer center={center} zoom={5} style={{ width: "100%", height: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {clients.map(c => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={icon}>
          <Popup>
            <div className="text-xs space-y-0.5">
              <p className="font-semibold">{c.nome_fantasia || c.name}</p>
              {c.empresa && <p className="text-gray-600">{c.empresa}</p>}
              {(c.municipio || c.uf) && <p>{[c.municipio, c.uf].filter(Boolean).join(" / ")}</p>}
              {(c.telefone || c.phone) && <p>{c.telefone || c.phone}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}