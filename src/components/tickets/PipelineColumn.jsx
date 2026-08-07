import React, { useState, useRef, useMemo } from "react";
import PipelineCard from "./PipelineCard";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

export default function PipelineColumn({ column, tickets, ticketNumberMap, onDrop, onNewTicket, isFirst, isLast, groupBy = "none" }) {
  // Ordenar tickets desta coluna por created_date
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) =>
      new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  }, [tickets]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const dragCounter = useRef(0);

  // Swimlanes: agrupa cards por critério
  const groups = useMemo(() => {
    if (!groupBy || groupBy === "none") return null;
    const keyFn =
      groupBy === "client" ? (t) => t.client_name
      : groupBy === "assigned" ? (t) => t.assigned_to_name || t.assigned_to
      : (t) => t.requester;
    const map = new Map();
    sortedTickets.forEach(t => {
      const k = keyFn(t) || "Sem definição";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedTickets, groupBy]);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDragEnter = (e) => { e.preventDefault(); dragCounter.current++; setIsDraggingOver(true); };
  const handleDragLeave = () => { dragCounter.current--; if (dragCounter.current === 0) setIsDraggingOver(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    // text/plain é o tipo MIME compatível com todos os browsers (Firefox/Safari rejeitam tipos customizados)
    const ticketId = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("ticketId");
    if (ticketId) onDrop(ticketId, column.title);
  };

  const colColor = column.color || "hsl(var(--primary))";

  const renderCard = (ticket, idx) => (
    <div
      key={ticket.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", ticket.id);
        e.dataTransfer.effectAllowed = "move";
        const node = e.currentTarget;
        setTimeout(() => { if (node) node.style.opacity = "0.3"; }, 0);
      }}
      onDragEnd={(e) => {
        const node = e.currentTarget;
        if (node) node.style.opacity = "1";
      }}
    >
      <PipelineCard ticket={ticket} column={column} ticketNumber={ticketNumberMap?.get(ticket.id) || idx + 1} />
    </div>
  );

  const visibleTickets = sortedTickets.slice(0, visibleCount);

  return (
    <div className="flex flex-col h-full" style={{ minWidth: 248, maxWidth: 268 }}>
      {/* Column Header — discreto: ponto de cor fino + título + contagem */}
      <div className="flex items-center gap-2 px-1.5 py-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colColor }} />
        <h3 className="text-[12px] font-semibold text-foreground flex-1 truncate">{column.title}</h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">{tickets.length}</span>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex flex-col rounded-xl transition-all duration-150 ${
          isDraggingOver ? "border-2 border-dashed border-primary/50 bg-primary/5" : "border border-transparent"
        }`}
      >
        <div className="flex-1 overflow-y-auto px-0.5 py-1 space-y-2.5" style={{ scrollbarWidth: "thin" }}>
          {groups ? (
            groups.map(([name, items]) => {
              const collapsed = collapsedGroups[name];
              return (
                <div key={name}>
                  <button
                    onClick={() => setCollapsedGroups(p => ({ ...p, [name]: !p[name] }))}
                    className="w-full flex items-center gap-1.5 px-1.5 py-1.5 text-left rounded-md hover:bg-muted transition-colors"
                  >
                    {collapsed
                      ? <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    <span className="text-[11px] font-medium text-muted-foreground truncate flex-1">{name}</span>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">{items.length}</span>
                  </button>
                  {!collapsed && <div className="space-y-2.5 mt-1 mb-2">{items.map(renderCard)}</div>}
                </div>
              );
            })
          ) : (
            <>
              {visibleTickets.map(renderCard)}
              {sortedTickets.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="w-full py-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  Carregar mais ({sortedTickets.length - visibleCount} restantes)
                </button>
              )}
            </>
          )}

          {tickets.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-14 text-center ${isDraggingOver ? "text-primary" : "text-muted-foreground/60"}`}>
              {isDraggingOver ? (
                <p className="text-xs font-medium">Soltar aqui</p>
              ) : (
                <p className="text-[11px]">Nenhum item</p>
              )}
            </div>
          )}
        </div>

        {/* Add button */}
        {isFirst && onNewTicket && (
          <div className="p-1.5">
            <button
              onClick={onNewTicket}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-muted-foreground hover:text-primary hover:bg-primary/5"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}