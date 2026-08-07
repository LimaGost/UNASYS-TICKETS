import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import PageHeader from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  Ticket,
  ClipboardList,
  Kanban,
  Code,
  Users,
  Settings as SettingsIcon,
  ChevronRight,
  Zap,
  CheckSquare,
  BookOpen,
  Layers,
  Mail,
  MessageCircle,
  Building2,
  GitBranch,
  Shield,
  Package,
  FileText,
  ListChecks,
  SlidersHorizontal,
  Workflow,
  LayoutGrid,
} from "lucide-react";

function SectionBlock({ title, subtitle, icon: SectionIcon, iconColor, items, isAdmin }) {
  const visibleItems = items.filter(item => !item.adminOnly || isAdmin);
  if (visibleItems.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconColor} bg-muted`}>
          <SectionIcon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {/* Items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item, idx) => {
          const Icon = item.icon;
          const href = item.path || createPageUrl(item.page);
          const total = visibleItems.length;
          const remainder = total % 3;
          const isLastRow = idx >= total - (remainder || 3);
          const colSpan = isLastRow && remainder === 1 && idx === total - 1 ? "lg:col-span-3" : isLastRow && remainder === 2 && idx === total - 2 ? "" : "";
          return (
            <Link key={item.page || item.label} to={href} className={`border-border ${colSpan} ${idx % 3 !== 2 ? "border-r" : ""} ${!isLastRow ? "border-b" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-4 bg-card hover:bg-muted/40 transition-colors cursor-pointer group h-full">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors flex-shrink-0">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{item.description}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie todas as configurações do sistema organizadas por área"
      />

      {/* ── PESSOAL ── */}
      <SectionBlock
        title="Pessoal"
        subtitle="Suas preferências individuais"
        icon={Bell}
        iconColor="text-purple-400"
        isAdmin={isAdmin}
        items={[
          {
            label: "Notificações",
            description: "Configure alertas, horário silencioso e canais de notificação",
            icon: Bell,
            page: "NotificationSettings",
            color: "text-purple-400",
            adminOnly: false,
          },
        ]}
      />

      {/* ── ESTRUTURA BASE ── */}
      <SectionBlock
        title="Estrutura Base"
        subtitle="Verticais, usuários e dados fundamentais do sistema"
        icon={Building2}
        iconColor="text-fuchsia-400"
        isAdmin={isAdmin}
        items={[
          {
            label: "Verticais de Negócio",
            description: "Unidades de negócio (Microvics, Degust, etc.) — base de tudo",
            icon: Building2,
            page: "VerticalConfig",
            color: "text-fuchsia-400",
            adminOnly: true,
          },
          {
            label: "Usuários e Perfis",
            description: "Gerenciar usuários, papéis e permissões de acesso",
            icon: Users,
            page: "Users",
            color: "text-pink-400",
            adminOnly: true,
          },

          {
            label: "Configurações Gerais",
            description: "SLA global, horários comerciais e parâmetros do sistema",
            icon: SettingsIcon,
            page: "SystemSettings",
            color: "text-indigo-400",
            adminOnly: true,
          },
        ]}
      />

      {/* ── TICKETS E SUPORTE ── */}
      <SectionBlock
        title="Tickets e Suporte"
        subtitle="Configure como os tickets são criados, categorizados e gerenciados"
        icon={Ticket}
        iconColor="text-blue-400"
        isAdmin={isAdmin}
        items={[
          {
            label: "Tipos de Ticket e Serviços",
            description: "Defina os tipos de ticket por vertical (Implantação, Suporte, etc.) e seus serviços",
            icon: Ticket,
            page: "TicketTypeConfig",
            color: "text-blue-400",
            adminOnly: true,
          },
          {
            label: "Categorias de Atendimento",
            description: "Categorias de classificação de implantações e suporte por vertical",
            icon: Layers,
            page: "CategoryConfig",
            color: "text-rose-400",
            adminOnly: true,
          },
          {
            label: "Campos Customizados",
            description: "Campos extras, flags, badges e informações adicionais nos tickets",
            icon: ClipboardList,
            page: "CustomFieldsConfig",
            color: "text-violet-400",
            adminOnly: true,
          },
          {
            label: "Formulários por Serviço",
            description: "Campos dinâmicos e personalizados para cada tipo de serviço",
            icon: FileText,
            page: "DynamicFormConfig",
            color: "text-green-400",
            adminOnly: true,
          },
          {
            label: "Configurações de Suporte",
            description: "SLA, atribuição automática e horários de atendimento do suporte",
            icon: Shield,
            page: "SuporteSettings",
            color: "text-teal-400",
            adminOnly: true,
          },
        ]}
      />

      {/* ── IMPLANTAÇÃO ── */}
      <SectionBlock
        title="Implantação"
        subtitle="Controle o fluxo completo do processo de implantação de clientes"
        icon={Workflow}
        iconColor="text-cyan-400"
        isAdmin={isAdmin}
        items={[
          {
            label: "Quadro Kanban",
            description: "Colunas, etapas e regras de transição do fluxo Kanban por tipo de ticket",
            icon: Kanban,
            page: "KanbanConfig",
            color: "text-cyan-400",
            adminOnly: true,
          },
          {
            label: "Checklists de Etapas",
            description: "Itens obrigatórios para avançar o ticket de uma etapa para outra",
            icon: ListChecks,
            page: "ChecklistConfig",
            color: "text-emerald-400",
            adminOnly: true,
          },
          {
            label: "Regras de Automação",
            description: "Ações automáticas disparadas por eventos (atribuição, SLA, status)",
            icon: Zap,
            page: "AutomationRules",
            color: "text-orange-400",
            adminOnly: true,
          },
          {
            label: "Escalonamento",
            description: "Regras para escalar tickets críticos automaticamente com base em SLA ou urgência",
            icon: GitBranch,
            page: "EscalationSettings",
            color: "text-red-400",
            adminOnly: true,
          },
        ]}
      />

      {/* ── CONHECIMENTO ── */}
      <SectionBlock
        title="Conhecimento"
        subtitle="Base de conhecimento interna e templates de atendimento"
        icon={BookOpen}
        iconColor="text-teal-400"
        isAdmin={isAdmin}
        items={[{
            label: "Base de Conhecimento",
            description: "Categorias e configurações dos artigos da base interna e do portal",
            icon: BookOpen,
            page: "KnowledgeBaseSettings",
            color: "text-teal-400",
            adminOnly: true,
          },
          {
            label: "Templates de Resposta",
            description: "Modelos prontos de resposta rápida para agilizar o atendimento",
            icon: ClipboardList,
            page: "ResponseTemplates",
            color: "text-sky-400",
            adminOnly: true,
          },
        ]}
      />

      {/* ── INTEGRAÇÕES ── */}
      <SectionBlock
        title="Integrações e Canais"
        subtitle="Conecte o sistema com e-mail, WhatsApp e sistemas externos"
        icon={Code}
        iconColor="text-yellow-400"
        isAdmin={isAdmin}
        items={[
          {
            label: "Automação de E-mails",
            description: "Processar e-mails recebidos e criar tickets automaticamente via Gmail",
            icon: Mail,
            page: "EmailAutomationConfig",
            color: "text-blue-400",
            adminOnly: true,
          },
          {
            label: "WhatsApp / Metabot",
            description: "Integração com Metabot para atendimento e triagem via WhatsApp",
            icon: MessageCircle,
            page: "MetabotConfig",
            color: "text-green-400",
            adminOnly: true,
          },
          {
            label: "API e Webhooks",
            description: "Documentação dos endpoints para integrar sistemas externos",
            icon: Code,
            page: "WebhookDocs",
            color: "text-yellow-400",
            adminOnly: true,
          },
        ]}
      />
    </div>
  );
}