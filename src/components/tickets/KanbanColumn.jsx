import React, { useState, useRef, useMemo } from "react";
import KanbanCard from "./KanbanCard";
import GroupedKanbanCard from "./GroupedKanbanCard";

export default function KanbanColumnView({ column, tickets, onDrop, groupBy = "none" }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const ticketId = e.dataTransfer.getData("ticketId");
    if (ticketId) onDrop(ticketId, column.title);
  };

  const groupedTickets = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = {};
    tickets.forEach(ticket => {
      const key = groupBy === "client"
        ? (ticket.client_name || "Sem cliente")
        : (ticket.requester || "Sem solicitante");
      if (!groups[key]) groups[key] = [];
      groups[key].push(ticket);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, tickets]) => ({ name, tickets }));
  }, [tickets, groupBy]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-shrink-0 w-full rounded-xl flex flex-col h-full"
      style={{
        background: isDraggingOver ? "rgba(139,92,246,0.08)" : "rgba(15,20,35,0.6)",
        border: `1px solid ${isDraggingOver ? "#8B5CF6" : "rgba(139,92,246,0.2)"}`,
        boxShadow: isDraggingOver ? "0 0 0 2px rgba(139,92,246,0.25)" : "none",
        transition: "border-color 0.1s, background 0.1s, box-shadow 0.1s",
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[rgba(139,92,246,0.15)] flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{
            backgroundColor: column.color || "#8B5CF6",
            boxShadow: `0 0 8px ${column.color || "#8B5CF6"}50`
          }}
        />
        <h3 className="text-sm font-bold text-white truncate flex-1">{column.title}</h3>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            backgroundColor: `${column.color || "#8B5CF6"}20`,
            color: column.color || "#A78BFA"
          }}
        >
          {tickets.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {groupBy === "none" ? (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("ticketId", ticket.id);
                e.dataTransfer.effectAllowed = "move";
                const node = e.currentTarget;
                setTimeout(() => { if (node) node.style.opacity = "0.35"; }, 0);
              }}
              onDragEnd={(e) => {
                const node = e.currentTarget;
                if (node) node.style.opacity = "1";
              }}
              style={{ cursor: "grab" }}
            >
              <KanbanCard ticket={ticket} column={column} />
            </div>
          ))
        ) : (
          groupedTickets?.map((group) => (
            <div key={group.name}>
              <GroupedKanbanCard
                groupName={group.name}
                tickets={group.tickets}
                groupBy={groupBy}
              />
            </div>
          ))
        )}

        {tickets.length === 0 && (
          <div className="text-center text-xs text-gray-600 py-12 flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/5 flex items-center justify-center mb-1">
              <div className="w-5 h-5 border-2 border-dashed border-gray-700 rounded" />
            </div>
            <p>{isDraggingOver ? "Solte aqui" : "Nenhum ticket"}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {column.sla_hours && (
        <div className="p-2.5 border-t border-[rgba(139,92,246,0.08)] bg-[#0B0D15]/50">
          <p className="text-[10px] text-gray-600 text-center">
            SLA: <span className="text-[#8B5CF6] font-semibold">{column.sla_hours}h</span>
          </p>
        </div>
      )}
    </div>
  );
}