import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X, LayoutDashboard, Kanban, Ticket, Users, BookOpen, BarChart3, Settings, Calendar, FileText, User, PanelLeftClose, MoreHorizontal } from "lucide-react";
import { useTabs, closeTab } from "@/hooks/useTabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Track recently closed tabs to prevent immediate reopen
export let lastClosedTabId = null;
export let lastClosedTimestamp = 0;

export const PAGE_LABELS = {
  "/": "Meu Perfil",
  "/Dashboard": "Dashboard",
  "/Tickets": "Implantação",
  "/Suporte": "Suporte",
  "/Clients": "Clientes",
  "/clients": "Cliente",
  "/KnowledgeBase": "Base de Conhecimento",
  "/ResponseTemplates": "Templates",
  "/Reports": "Relatórios",
  "/Settings": "Configurações",
  "/Agenda": "Agenda",
  "/Users": "Usuários",
  "/perfil": "Meu Perfil",
  "/implantacao": "Atendimentos",
};

const PAGE_ICONS = {
  "/": LayoutDashboard,
  "/Dashboard": LayoutDashboard,
  "/Tickets": Kanban,
  "/Suporte": Ticket,
  "/Clients": Users,
  "/clients": Users,
  "/KnowledgeBase": BookOpen,
  "/ResponseTemplates": FileText,
  "/Reports": BarChart3,
  "/Settings": Settings,
  "/Agenda": Calendar,
  "/Users": Users,
  "/perfil": User,
  "/implantacao": Kanban,
};

const PINNED_TABS = [];
const MAX_VISIBLE_TABS = 6;

function getIcon(path) {
  const direct = PAGE_ICONS[path];
  if (direct) return direct;
  const matched = Object.keys(PAGE_ICONS).find(k => k !== '/' && path.startsWith(k + '/'));
  return matched ? PAGE_ICONS[matched] : LayoutDashboard;
}

function isTabActive(tab, pathname) {
  if (tab.path === '/') return pathname === '/';
  return pathname === tab.path || pathname.startsWith(tab.path + '/');
}

export default function TabBar() {
  const { tabs } = useTabs();
  const location = useLocation();
  const navigate = useNavigate();
  const [overflowOpen, setOverflowOpen] = useState(false);

  const allTabs = tabs;

  // Divisão: até MAX_VISIBLE_TABS visíveis, restante vai pro dropdown
  // Garante que a aba ativa esteja sempre visível
  const activeIdx = allTabs.findIndex(t => isTabActive(t, location.pathname));
  let visibleTabs = allTabs;
  let hiddenTabs = [];
  if (allTabs.length > MAX_VISIBLE_TABS) {
    visibleTabs = allTabs.slice(0, MAX_VISIBLE_TABS);
    hiddenTabs = allTabs.slice(MAX_VISIBLE_TABS);
    if (activeIdx >= MAX_VISIBLE_TABS) {
      const activeTab = allTabs[activeIdx];
      const displaced = visibleTabs[MAX_VISIBLE_TABS - 1];
      visibleTabs = [...allTabs.slice(0, MAX_VISIBLE_TABS - 1), activeTab];
      hiddenTabs = hiddenTabs.filter(t => t.id !== activeTab.id).concat(displaced);
    }
  }

  function handleClose(e, tab) {
    e.preventDefault();
    e.stopPropagation();
    lastClosedTabId = tab.id;
    lastClosedTimestamp = Date.now();
    closeTab(tab.id);
    if (isTabActive(tab, location.pathname)) {
      const idx = allTabs.findIndex(t => t.id === tab.id);
      const fallback = allTabs[idx - 1] || allTabs[idx + 1] || PINNED_TABS[0];
      if (fallback) navigate(fallback.path);
    }
  }

  function handleCloseAll(e) {
    e.preventDefault();
    e.stopPropagation();
    const tabsToClose = [...allTabs];
    tabsToClose.forEach(tab => {
      lastClosedTabId = tab.id;
      lastClosedTimestamp = Date.now();
      closeTab(tab.id);
    });
    navigate('/');
  }

  function handleCloseHidden(e, tab) {
    e.preventDefault();
    e.stopPropagation();
    lastClosedTabId = tab.id;
    lastClosedTimestamp = Date.now();
    closeTab(tab.id);
  }

  return (
    <div
      className="flex items-end overflow-x-auto flex-shrink-0 px-2 gap-0.5"
      style={{
        height: "44px",
        minHeight: "44px",
        background: "#07030f",
        borderBottom: "1px solid rgba(124,58,237,0.2)",
      }}
    >
      {/* Botão Fechar Todas */}
      {allTabs.length > PINNED_TABS.length && (
        <button
          onClick={handleCloseAll}
          className="flex items-center gap-1.5 h-[36px] px-2.5 text-[10px] font-semibold rounded-t-lg mr-1 transition-all flex-shrink-0"
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderBottom: "1px solid transparent",
            color: "rgba(248,113,113,0.7)",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(239,68,68,0.15)";
            e.currentTarget.style.color = "#f87171";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(239,68,68,0.07)";
            e.currentTarget.style.color = "rgba(248,113,113,0.7)";
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.18)";
          }}
          title="Fechar todas as abas"
        >
          <PanelLeftClose className="w-3 h-3" />
        </button>
      )}

      {visibleTabs.map((tab) => {
        const active = isTabActive(tab, location.pathname);
        const Icon = tab.icon || getIcon(tab.path);
        return (
          <div
            key={tab.id}
            className="flex items-center h-[36px] group relative flex-shrink-0 rounded-t-lg"
            style={{
              background: active ? "#130a20" : "transparent",
              border: active ? "1px solid rgba(124,58,237,0.25)" : "1px solid transparent",
              borderBottom: active ? "1px solid #07030f" : "1px solid transparent",
              marginBottom: active ? "-1px" : "0",
              minWidth: "90px",
              maxWidth: "200px",
              transition: "all 0.12s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(124,58,237,0.08)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            {/* Top accent line for active */}
            {active && (
              <div
                className="absolute top-0 left-2 right-2 h-[2px] rounded-full"
                style={{ background: "linear-gradient(90deg, #F97316, #A855F7)" }}
              />
            )}

            <Link
              to={tab.path}
              className="flex items-center gap-1.5 h-full pl-3 pr-1 select-none flex-1 min-w-0"
              style={{ color: active ? "#e2c9ff" : "rgba(148,111,200,0.45)" }}
            >
              <Icon className="w-3 h-3 flex-shrink-0" style={{ opacity: active ? 1 : 0.7 }} />
              <span
                className="truncate"
                style={{ fontSize: "11.5px", fontWeight: active ? 600 : 400, letterSpacing: "0.01em" }}
              >
                {tab.label}
              </span>
            </Link>

            <button
              onClick={(e) => handleClose(e, tab)}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 mr-1.5 transition-all"
              style={{ color: "rgba(168,85,247,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(168,85,247,0.4)"; e.currentTarget.style.background = "transparent"; }}
              title="Fechar aba"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        );
      })}

      {/* Dropdown de abas ocultas */}
      {hiddenTabs.length > 0 && (
        <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1 h-[36px] px-3 ml-1 text-[11px] font-semibold rounded-t-md transition-all flex-shrink-0"
              style={{
                background: "rgba(124,58,237,0.12)",
                border: "1px solid rgba(124,58,237,0.3)",
                color: "#a78bfa",
              }}
              title={`${hiddenTabs.length} aba(s) oculta(s)`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>+{hiddenTabs.length}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-64 p-1"
            style={{ background: "#120a22", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: "rgba(168,85,247,0.5)" }}>
              Mais abas ({hiddenTabs.length})
            </p>
            <div className="max-h-72 overflow-y-auto">
              {hiddenTabs.map(tab => {
                const Icon = tab.icon || getIcon(tab.path);
                return (
                  <div
                    key={tab.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgba(124,58,237,0.12)] group cursor-pointer"
                    onClick={() => { navigate(tab.path); setOverflowOpen(false); }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(168,85,247,0.7)" }} />
                    <span className="flex-1 text-[12px] truncate" style={{ color: "#d8b4fe" }}>{tab.label}</span>
                    <button
                      onClick={(e) => handleCloseHidden(e, tab)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-all"
                      style={{ color: "rgba(168,85,247,0.5)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "rgba(168,85,247,0.5)"; e.currentTarget.style.background = "transparent"; }}
                      title="Fechar aba"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}