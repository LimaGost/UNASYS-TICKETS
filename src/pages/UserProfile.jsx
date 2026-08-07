import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Headphones, Mail, Calendar, HelpCircle,
  Camera, Loader2, Settings, Save, X, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import SignatureEditor from "@/components/profile/SignatureEditor";
import PanelCard from "@/components/profile/PanelCard";
import TicketCounts from "@/components/profile/TicketCounts";
import AgendaPanel from "@/components/profile/AgendaPanel";
import InboxPanel from "@/components/profile/InboxPanel";
import MuralAvisos from "@/components/profile/MuralAvisos";

export default function UserProfile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const isAdmin = currentUser?.role === "admin";
  const myEmail = currentUser?.email;
  const myVertical = currentUser?.vertical;

  const { data: myTickets = [] } = useQuery({
    queryKey: ["profile-my-tickets", myEmail],
    queryFn: () => api.entities.Ticket.filter({ assigned_to: myEmail }, "-updated_date", 500),
    enabled: !!myEmail,
  });

  const { data: teamTickets = [] } = useQuery({
    queryKey: ["profile-team-tickets", myVertical],
    queryFn: () => api.entities.Ticket.filter({ vertical: myVertical }, "-updated_date", 500),
    enabled: !!myVertical,
  });

  const { data: allTickets = [] } = useQuery({
    queryKey: ["profile-all-tickets"],
    queryFn: () => api.entities.Ticket.list("-updated_date", 500),
    enabled: isAdmin,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["profile-appointments", myEmail],
    queryFn: () => api.entities.Appointment.filter({ owner_email: myEmail }, "-date", 50),
    enabled: !!myEmail,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.functions.invoke('updateOwnProfile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Perfil atualizado!");
      setEditOpen(false);
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const handlePhotoClick = () => fileRef.current?.click();
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    await api.auth.updateMe({ avatar_url: file_url });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    toast.success("Foto atualizada!");
    setUploading(false);
  };

  const openEdit = () => {
    setForm({
      full_name: currentUser?.full_name || "",
      email_signature: currentUser?.email_signature || "",
      email_signature_fields: currentUser?.email_signature_fields || {},
    });
    setEditOpen(true);
  };

  const initials = currentUser?.full_name
    ? currentUser.full_name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()
    : "?";

  const handleTicketClick = (filter) => {
    // Navega para a página de tickets com filtro aplicado
    navigate("/Tickets", { state: { filter } });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* ── SAUDAÇÃO ── */}
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-xl overflow-hidden ring-2 ring-primary/30 bg-primary">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-lg font-black">
                {initials}
              </div>
            )}
          </div>
          <button
            onClick={handlePhotoClick}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{ background: "hsl(var(--primary))", border: "2px solid hsl(var(--background))" }}
            title="Trocar foto"
          >
            {uploading
              ? <Loader2 className="w-3 h-3 text-white animate-spin" />
              : <Camera className="w-3 h-3 text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Olá, <span className="text-primary">{currentUser.full_name?.toUpperCase()}.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Que bom te ver por aqui! :)</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
            Para acessar os contadores de tickets é só expandir os indicadores que deseja visualizar e utilizar normalmente.
          </p>
        </div>

        <Button
          onClick={openEdit}
          size="sm"
          variant="outline"
          className="flex-shrink-0 gap-1.5 text-xs"
        >
          <Settings className="w-3.5 h-3.5" /> Editar perfil
        </Button>
      </div>

      {/* ── MURAL DE AVISOS ── */}
      <PanelCard icon={Megaphone} title="Mural de Avisos" accent="#F59E0B">
        <MuralAvisos currentUser={currentUser} />
      </PanelCard>

      {/* ── ROW 1: CONTADORES DE TICKETS ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PanelCard 
          icon={Headphones} 
          title="Meus tickets" 
          accent="#60A5FA" 
          expandable 
          defaultOpen
          action={{ label: "Ver todos", color: "#60A5FA" }}
          actionOnClick={() => handleTicketClick({ assigned_to: myEmail })}
        >
          <TicketCounts 
            tickets={myTickets} 
            onCountClick={(status) => {
              if (status) {
                handleTicketClick({ assigned_to: myEmail, status_column_title: status });
              } else {
                handleTicketClick({ assigned_to: myEmail });
              }
            }}
          />
        </PanelCard>

        <PanelCard 
          icon={Headphones} 
          title="Tickets da minha equipe" 
          accent="#60A5FA" 
          expandable 
          defaultOpen={false}
          action={{ label: "Ver todos", color: "#60A5FA" }}
          actionOnClick={() => handleTicketClick({ vertical: myVertical })}
        >
          <TicketCounts 
            tickets={teamTickets}
            onCountClick={(status) => {
              if (status) {
                handleTicketClick({ vertical: myVertical, status_column_title: status });
              } else {
                handleTicketClick({ vertical: myVertical });
              }
            }}
          />
        </PanelCard>

        {isAdmin && (
          <PanelCard 
            icon={Headphones} 
            title="Todos os tickets" 
            accent="#60A5FA" 
            expandable 
            defaultOpen={false}
            action={{ label: "Ver todos", color: "#60A5FA" }}
            actionOnClick={() => handleTicketClick({})}
          >
            <TicketCounts 
              tickets={allTickets}
              onCountClick={(status) => {
                if (status) {
                  handleTicketClick({ status_column_title: status });
                } else {
                  handleTicketClick({});
                }
              }}
            />
          </PanelCard>
        )}
      </div>

      {/* ── ROW 2: PAINÉIS DE INFO ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Mensagens - Caixa de Entrada */}
        <PanelCard
          icon={Mail}
          title="Mensagens"
          accent="#FB923C"
          action={{ href: "/EmailConfigStatus", label: "Caixa de entrada", color: "#F97316" }}
        >
          <InboxPanel userEmail={myEmail} />
        </PanelCard>

        {/* Agenda */}
        <PanelCard
          icon={Calendar}
          title="Agenda"
          accent="#A78BFA"
          action={{ href: "/Agenda", label: "Ver agenda", color: "#F97316" }}
        >
          <AgendaPanel appointments={appointments} />
        </PanelCard>

        {/* Central de ajuda */}
        <PanelCard
          icon={HelpCircle}
          title="Central de ajuda"
          accent="#FB923C"
          action={{ href: "/KnowledgeBase", label: "Acessar base de conhecimento", color: "#F97316" }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            Acesso à base de conhecimento e documentação de ferramentas.
          </p>
        </PanelCard>
      </div>

      {/* ── EDIT PROFILE DIALOG ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-400" /> Editar perfil
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[11px] uppercase tracking-wider mb-1.5 block text-muted-foreground">Nome completo</Label>
              <Input
                value={form.full_name || ""}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-wider mb-2 block text-muted-foreground">
                <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                Assinatura de e-mail
              </Label>
              <SignatureEditor
                value={form.email_signature || ""}
                onChange={(content) => setForm(prev => ({ ...prev, email_signature: content }))}
                savedFields={form.email_signature_fields}
                onFieldsChange={(fields) => setForm(prev => ({ ...prev, email_signature_fields: fields }))}
              />
              <p className="text-[10px] mt-1.5 text-muted-foreground">
                Incluída automaticamente nos e-mails enviados aos clientes.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}