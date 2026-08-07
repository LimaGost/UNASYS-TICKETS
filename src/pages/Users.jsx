import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  UserPlus, Mail, Shield, Building2, Link2, Store, Users as UsersIcon,
  Search, Crown, User, Globe, AlertCircle, CheckCircle2, Edit2,
  Lock, Layers, X
} from "lucide-react";

const PROFILE_TYPES = [
  { value: "interno", label: "Interno", desc: "Analista / Gestor", icon: UsersIcon, color: "#a78bfa", bg: "rgba(139,92,246,0.15)" },
];

const FILTER_TABS = [
  { value: "all", label: "Todos" },
  { value: "admin", label: "Admin" },
  { value: "interno", label: "Internos" },
];

function Avatar({ user, size = 10 }) {
  const isClient = user.tipo_perfil === "cliente";
  const sizeClass = size === 10 ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{ background: isClient ? "rgba(59,130,246,0.2)" : "rgba(139,92,246,0.2)", color: isClient ? "#60a5fa" : "#a78bfa" }}>
      {(user.full_name || user.email || "?")[0].toUpperCase()}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3 bg-card border border-border">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [inviteForm, setInviteForm] = useState({ email: "", role: "user" });
  const [editForm, setEditForm] = useState({
    vertical: "", can_access_all_verticals: false,
    tipo_perfil: "interno", cargo: "",
  });
  const [inviting, setInviting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.functions.invoke('listInternalUsers', {});
      // Normaliza campos que podem estar em user.data (extras) ou na raiz
      return res.data?.users || [];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: implantacoes = [] } = useQuery({
    queryKey: ["todas-implantacoes"],
    queryFn: () => api.entities.ClienteImplantacao.list(),
  });

  const { data: verticais = [] } = useQuery({
    queryKey: ["verticais"],
    queryFn: () => api.entities.Vertical.filter({ active: true }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      // Usa a função backend que salva corretamente no campo data (tipo_perfil, vertical, etc)
      await api.functions.invoke('updateUserProfile', {
        userId,
        tipo_perfil: data.tipo_perfil,
        vertical: data.vertical || null,
        can_access_all_verticals: data.can_access_all_verticals,
        cargo: data.cargo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowEdit(false);
      setEditUser(null);
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data) => api.users.inviteUser(data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowInvite(false);
      setInviteForm({ email: "", role: "user" });
    },
  });

  const handleInvite = (e) => {
    e.preventDefault();
    setInviting(true);
    inviteUserMutation.mutate(inviteForm, { onSettled: () => setInviting(false) });
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      vertical: user.vertical || "",
      can_access_all_verticals: user.can_access_all_verticals ?? false,
      tipo_perfil: user.tipo_perfil || "interno",
      cargo: user.cargo || "",
    });
    setShowEdit(true);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    updateUserMutation.mutate({ userId: editUser.id, data: editForm });
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchType =
      filterTab === "all" ||
      (filterTab === "admin" && u.role === "admin") ||
      (filterTab === "interno" && u.tipo_perfil === "interno");
    return matchSearch && matchType;
  });

  // Stats
  const totalAdmin = users.filter(u => u.role === "admin").length;
  const totalInterno = users.filter(u => u.tipo_perfil === "interno").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Permissões, perfis e vínculos com clientes</p>
        </div>
        {currentUser?.role === "admin" && (
          <Button onClick={() => setShowInvite(true)} className="gap-2 text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}>
            <UserPlus className="w-4 h-4" /> Convidar
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total" value={users.length} icon={UsersIcon} color="#a78bfa" />
        <StatCard label="Admins" value={totalAdmin} icon={Crown} color="#F97316" />
        <StatCard label="Internos" value={totalInterno} icon={Shield} color="#a78bfa" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setFilterTab(tab.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={filterTab === tab.value
                ? { background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }
                : { color: "hsl(var(--muted-foreground))" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          {users.length === 0 ? "Nenhum usuário encontrado" : "Nenhum resultado para os filtros selecionados"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map(u => (
            <div key={u.id} className="rounded-xl p-4 flex flex-col gap-3 transition-all group bg-card border border-border hover:border-primary/40">

                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={u} size={10} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {u.email}
                      </div>
                    </div>
                  </div>
                  {currentUser?.role === "admin" && (
                    <button onClick={() => openEdit(u)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {u.role === "admin" && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                      <Crown className="w-3 h-3" /> Admin
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    <UsersIcon className="w-3 h-3" /> Interno
                  </span>
                  {u.can_access_all_verticals && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                      <Globe className="w-3 h-3" /> Todas verticais
                    </span>
                  )}
                  {u.cargo && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                      <Shield className="w-3 h-3" /> {u.cargo}
                    </span>
                  )}
                  {u.vertical && !u.can_access_all_verticals && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-accent text-accent-foreground">
                      <Layers className="w-3 h-3" /> {u.vertical}
                    </span>
                  )}
                </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <UserPlus className="w-4 h-4 text-primary" />
              </div>
              Convidar Usuário
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">E-mail *</Label>
              <Input type="email" value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                required placeholder="usuario@exemplo.com" />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Função na plataforma *</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                {[
                  { value: "user", label: "Usuário", desc: "Acesso padrão", icon: User, color: "#a78bfa" },
                  { value: "admin", label: "Admin", desc: "Acesso total", icon: Crown, color: "#fb923c" },
                ].map(opt => {
                  const Icon = opt.icon;
                  const sel = inviteForm.role === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setInviteForm(p => ({ ...p, role: opt.value }))}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                       background: sel ? `${opt.color}22` : "hsl(var(--muted))",
                       border: `2px solid ${sel ? opt.color : "hsl(var(--border))"}`,
                      }}>
                      <Icon className="w-4 h-4 mb-1.5" style={{ color: opt.color }} />
                      <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted border border-border">
              O usuário receberá um e-mail com link de acesso. Após entrar, configure o perfil e vínculos.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-white">Cancelar</Button>
              <Button type="submit" disabled={inviting} className="text-white gap-2" style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}>
                <Mail className="w-4 h-4" />
                {inviting ? "Enviando..." : "Enviar Convite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {editUser && <Avatar user={editUser} size={10} />}
              <div>
                <div className="text-base font-semibold text-foreground">{editUser?.full_name || "Usuário"}</div>
                <div className="text-xs text-muted-foreground font-normal">{editUser?.email}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-5 mt-2">

            {/* Tipo de Perfil */}
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Tipo de Perfil
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {PROFILE_TYPES.map(opt => {
                  const Icon = opt.icon;
                  const sel = editForm.tipo_perfil === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setEditForm(p => ({ ...p, tipo_perfil: opt.value }))}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{
                        background: sel ? opt.bg : "hsl(var(--muted))",
                        border: `2px solid ${sel ? opt.color : "hsl(var(--border))"}`,
                      }}>
                      <Icon className="w-5 h-5 mb-2" style={{ color: opt.color }} />
                      <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* INTERNO */}
            {editForm.tipo_perfil === "interno" && (
              <div className="space-y-4 p-4 rounded-xl bg-accent/30 border border-border">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Permissões de Acesso</span>
                </div>

                {/* Cargo */}
                <div>
                  <Label className="text-muted-foreground text-xs mb-1 block">Cargo</Label>
                  <Select value={editForm.cargo} onValueChange={(v) => setEditForm(prev => ({ ...prev, cargo: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diretor">Diretor — acesso total + Painel do Diretor</SelectItem>
                      <SelectItem value="Analista Senior">Analista Senior — tudo, restrito à vertical</SelectItem>
                      <SelectItem value="Analista Interno">Analista Interno — implantação, suporte, agenda e conhecimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs mb-1 block">Vertical de atuação</Label>
                  <Select value={editForm.vertical} onValueChange={(v) => setEditForm(prev => ({ ...prev, vertical: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a vertical..." />
                    </SelectTrigger>
                    <SelectContent>
                      {verticais.map(v => (
                        <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                  <Checkbox id="all-verticals" checked={editForm.can_access_all_verticals}
                    onCheckedChange={(v) => setEditForm(prev => ({ ...prev, can_access_all_verticals: v }))} />
                  <div>
                    <Label htmlFor="all-verticals" className="text-sm text-foreground cursor-pointer font-medium">Acesso a todas as verticais</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">O usuário poderá ver e gerenciar chamados de qualquer vertical</p>
                  </div>
                </div>
              </div>
            )}



            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setShowEdit(false)} className="gap-1.5">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} className="text-white gap-2" style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}>
                <CheckCircle2 className="w-4 h-4" />
                {updateUserMutation.isPending ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}