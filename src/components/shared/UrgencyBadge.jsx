import React from "react";

const urgencyConfig = {
  baixa: { label: "Baixa", bg: "bg-[#3B82F6]/15", text: "text-[#60A5FA]", dot: "bg-[#3B82F6]" },
  media: { label: "Média", bg: "bg-[#F59E0B]/15", text: "text-[#FBBF24]", dot: "bg-[#F59E0B]" },
  alta: { label: "Alta", bg: "bg-[#F97316]/15", text: "text-[#FB923C]", dot: "bg-[#F97316]" },
  critica: { label: "Crítica", bg: "bg-[#EF4444]/15", text: "text-[#F87171]", dot: "bg-[#EF4444]" },
};

export default function UrgencyBadge({ urgency }) {
  const c = urgencyConfig[urgency] || urgencyConfig.media;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}