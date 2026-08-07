import React from "react";
import { motion } from "framer-motion";

export default function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const colorMap = {
    purple: { bg: "bg-[#8B5CF6]/10", text: "text-[#A78BFA]", iconBg: "bg-[#8B5CF6]/20", border: "border-[#8B5CF6]/20" },
    blue: { bg: "bg-[#3B82F6]/10", text: "text-[#60A5FA]", iconBg: "bg-[#3B82F6]/20", border: "border-[#3B82F6]/20" },
    orange: { bg: "bg-[#F59E0B]/10", text: "text-[#FBBF24]", iconBg: "bg-[#F59E0B]/20", border: "border-[#F59E0B]/20" },
    red: { bg: "bg-[#EF4444]/10", text: "text-[#F87171]", iconBg: "bg-[#EF4444]/20", border: "border-[#EF4444]/20" },
    green: { bg: "bg-[#10B981]/10", text: "text-[#34D399]", iconBg: "bg-[#10B981]/20", border: "border-[#10B981]/20" },
    cyan: { bg: "bg-[#06B6D4]/10", text: "text-[#22D3EE]", iconBg: "bg-[#06B6D4]/20", border: "border-[#06B6D4]/20" },
  };

  const c = colorMap[color] || colorMap.purple;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className={`rounded-xl ${c.bg} border ${c.border} p-4 md:p-5 flex items-start gap-3 md:gap-4 transition-all duration-300 cursor-pointer hover:border-[#8B5CF6]/40 hover:shadow-lg hover:shadow-[#8B5CF6]/5 group`}
    >
      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}>
        <Icon className={`w-4 h-4 md:w-5 md:h-5 ${c.text}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <p className={`text-xl md:text-2xl font-bold ${c.text} mt-0.5`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
}