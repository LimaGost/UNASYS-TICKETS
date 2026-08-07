import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import NotificationBell from "./components/notifications/NotificationBell";
import TabBarInline from "./components/TabBarInline";
import { useTheme } from "@/lib/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import AccessDenied from "./components/AccessDenied";
import {
  LayoutDashboard, Kanban, Users, BookOpen, BarChart3, Settings,
  ChevronLeft, ChevronRight, Menu, X, Ticket, Calendar, FileText,
  LogOut, SettingsIcon, Mail, Sun, Moon, Shield
} from "lucide-react";

const navGroups = [
  {
    label: "Principal",
    items: [
      { label: "Meu Perfil", page: "UserProfile", icon: SettingsIcon, path: "/perfil" },
    ]
  },
  {
    label: "Atendimento",
    items: [
      { label: "Implantação", page: "Tickets", icon: Kanban },
      { label: "Suporte", page: "Suporte", icon: Ticket },
      { label: "Agenda", page: "Agenda", icon: Calendar },
    ]
  },
  {
    label: "Clientes",
    items: [
      { label: "Clientes", page: "Clients", icon: Users },
    ]
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Base de Conhecimento", page: "KnowledgeBase", icon: BookOpen },
      { label: "Templates", page: "ResponseTemplates", icon: FileText },
    ]
  },
  {
    label: "Análise",
    items: [
      { label: "Relatórios", page: "Reports", icon: BarChart3 },
    ]
  },
  {
    label: "Sistema",
    items: [
      { label: "Configurações", page: "Settings", icon: Settings },
      { label: "Status de E-mail", page: "EmailConfigStatus", icon: Mail },
    ]
  }
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const tipoPerfil = currentUser?.tipo_perfil || currentUser?.data?.tipo_perfil;
  const { isDiretor, canAccessPage } = usePermissions();

  // Menu filtrado pelo nível de acesso (Diretor / Analista Senior / Analista Interno)
  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => canAccessPage(i.page)) }))
    .filter(g => g.items.length > 0);
  // Bloqueia apenas se o usuário carregou mas não tem perfil nem é admin
  // Analistas internos (tipo_perfil="interno") devem ver o menu normalmente
  if (currentUser && !tipoPerfil && currentUser?.role !== "admin") return null;

  const userInitials = currentUser?.full_name
    ? currentUser.full_name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out
          ${collapsed ? "w-[64px]" : "w-[240px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        `}
        style={{
          background: "hsl(var(--sidebar-bg))",
          borderRight: "1px solid hsl(var(--sidebar-border))",
        }}
      >
        {/* Logo area */}
        <div
          className={`h-[60px] flex items-center flex-shrink-0 ${collapsed ? "justify-center px-2" : "px-4"}`}
          style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "" : "flex-1"}`}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--primary))" }}
            >
              <Ticket className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-[13px] font-bold block truncate text-foreground">
                  Unasys Tickets
                </span>
                <span className="text-[10px] truncate block text-muted-foreground">
                  Gestão de Implantação
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex w-6 h-6 items-center justify-center rounded hover:bg-muted transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="hidden lg:flex absolute -right-3 top-[22px] w-6 h-6 items-center justify-center rounded-full transition-colors text-muted-foreground hover:text-foreground"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Painel do Diretor — visível só para Diretores */}
          {isDiretor && (
            <div className="mb-1">
              {!collapsed && (
                <div className="px-4 pt-3 pb-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: "hsl(var(--sidebar-group-label))" }}>
                    Executivo
                  </span>
                </div>
              )}
              {collapsed && <div className="my-2 mx-3 border-t border-border" />}
              <Link
                to="/diretor"
                title={collapsed ? "Painel do Diretor" : undefined}
                aria-label="Painel do Diretor"
                className={`relative flex items-center mx-2 rounded-md transition-all duration-150 cursor-pointer group ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"}`}
                style={currentPageName === "DiretorDashboard"
                  ? { background: "hsl(var(--sidebar-active-bg))", color: "hsl(var(--sidebar-text-active))" }
                  : { color: "hsl(var(--sidebar-text))" }}
                onMouseEnter={e => { if (currentPageName !== "DiretorDashboard") e.currentTarget.style.background = "hsl(var(--muted))"; }}
                onMouseLeave={e => { if (currentPageName !== "DiretorDashboard") e.currentTarget.style.background = ""; }}
              >
                {currentPageName === "DiretorDashboard" && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "hsl(var(--sidebar-active-accent))" }} />
                )}
                <Shield className="w-[15px] h-[15px] flex-shrink-0"
                  style={{ color: currentPageName === "DiretorDashboard" ? "hsl(var(--sidebar-active-accent))" : "hsl(var(--sidebar-text))", opacity: currentPageName === "DiretorDashboard" ? 1 : 0.7 }} />
                {!collapsed && <span className="text-[13px] leading-none truncate" style={{ fontWeight: currentPageName === "DiretorDashboard" ? 600 : 400 }}>Painel do Diretor</span>}
                {collapsed && (
                  <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                    style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    Painel do Diretor
                  </div>
                )}
              </Link>
            </div>
          )}

          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div className="px-4 pt-3 pb-1.5">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "hsl(var(--sidebar-group-label))" }}
                  >
                    {group.label}
                  </span>
                </div>
              )}
              {collapsed && (
                <div className="my-2 mx-3 border-t border-border" />
              )}

              {group.items.map((item) => {
                const isActive = currentPageName === item.page;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.page}
                    to={item.path || createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`
                      relative flex items-center mx-2 rounded-md
                      transition-all duration-150 cursor-pointer group
                      ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"}
                    `}
                    style={
                      isActive
                        ? {
                            background: "hsl(var(--sidebar-active-bg))",
                            color: "hsl(var(--sidebar-text-active))",
                          }
                        : { color: "hsl(var(--sidebar-text))" }
                    }
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.background = "hsl(var(--muted))";
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.background = "";
                    }}
                  >
                    {/* Active accent bar */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: "hsl(var(--sidebar-active-accent))" }}
                      />
                    )}
                    <Icon
                      className="w-[15px] h-[15px] flex-shrink-0"
                      style={{
                        color: isActive
                          ? "hsl(var(--sidebar-active-accent))"
                          : "hsl(var(--sidebar-text))",
                        opacity: isActive ? 1 : 0.7,
                      }}
                    />
                    {!collapsed && (
                      <span
                        className="text-[13px] leading-none truncate min-w-0"
                        style={{ fontWeight: isActive ? 600 : 400 }}
                      >
                        {item.label}
                      </span>
                    )}
                    {collapsed && (
                      <div
                        className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-md text-[12px] font-medium
                          whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
                        style={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          color: "hsl(var(--foreground))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                      >
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User area */}
        <div
          className="p-3 flex-shrink-0"
          style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}
        >
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                style={{ background: "hsl(var(--primary))" }}
              >
                {currentUser?.avatar_url
                  ? <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : userInitials}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                style={{ background: "hsl(var(--primary))" }}
              >
                {currentUser?.avatar_url
                  ? <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground truncate">
                  {currentUser?.full_name || "Usuário"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentUser?.email}
                </p>
              </div>
              <button
                onClick={() => api.auth.logout()}
                className="w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 transition-colors cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? "lg:ml-[64px]" : "lg:ml-[240px]"}`}
      >
        {/* Mobile topbar */}
        <header
          className="h-14 lg:hidden flex items-center px-4 sticky top-0 z-30"
          style={{
            background: "hsl(var(--topbar-bg))",
            borderBottom: "1px solid hsl(var(--topbar-border))",
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground cursor-pointer p-1 hover:text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 text-sm font-semibold text-foreground">Unasys Tickets</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NotificationBell />
          </div>
        </header>

        {/* Desktop topbar + TabBar */}
        <div
          className="hidden lg:flex fixed top-0 right-0 z-20 items-center"
          style={{
            left: collapsed ? 64 : 240,
            transition: "left 0.3s ease",
            height: "44px",
            background: "hsl(var(--topbar-bg))",
            borderBottom: "1px solid hsl(var(--topbar-border))",
          }}
        >
          <div className="flex-1 min-w-0 h-full">
            <TabBarInline />
          </div>
          <div className="flex items-center gap-1 px-3 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="hidden lg:block h-[44px] flex-shrink-0" />

        <main className="px-8 py-8 pb-20 min-h-screen w-full max-w-[1600px] mx-auto">
          {canAccessPage(currentPageName) ? children : <AccessDenied />}
        </main>
      </div>
    </div>
  );
}