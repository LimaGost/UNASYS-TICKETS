import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

export function CategoryPieChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-600 text-sm">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#161830",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "8px",
            color: "#E5E7EB",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SLABarChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-600 text-sm">Sem dados</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
        <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#161830",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "8px",
            color: "#E5E7EB",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="cumprido" fill="#10B981" radius={[4, 4, 0, 0]} name="Cumprido" />
        <Bar dataKey="estourado" fill="#EF4444" radius={[4, 4, 0, 0]} name="Estourado" />
      </BarChart>
    </ResponsiveContainer>
  );
}