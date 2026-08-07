import React, { useMemo, useState } from "react";
import { Inbox, X, ChevronRight, ChevronDown, GripVertical } from "lucide-react";

const fmtNum = (n) => (+n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtHours = (n) => {
  const totalMin = Math.round((+n || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
};
const fmtCell = (c, v) => (c.hours ? fmtHours(v) : fmtNum(v));

export default function ReportGrid({ columns, rows, groupBy, onGroupByChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState({}); // groupKey -> "loading" | "open"

  const numericCols = columns.filter((c) => c.numeric);

  const totals = useMemo(() => {
    const t = {};
    numericCols.forEach((c) => { t[c.key] = rows.reduce((s, r) => s + (+r[c.key] || 0), 0); });
    return t;
  }, [rows, columns]); // eslint-disable-line

  const groups = useMemo(() => {
    if (!groupBy.length) return null;
    const map = new Map();
    rows.forEach((r) => {
      const key = groupBy.map((k) => r[k] || "—").join(" · ");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, groupBy]);

  const toggleGroup = (key) => {
    if (expanded[key] === "open") {
      setExpanded((p) => ({ ...p, [key]: undefined }));
    } else {
      // simula carregamento assíncrono das linhas de detalhe
      setExpanded((p) => ({ ...p, [key]: "loading" }));
      setTimeout(() => setExpanded((p) => ({ ...p, [key]: "open" })), 450);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const key = e.dataTransfer.getData("text/report-column");
    if (key && !groupBy.includes(key)) onGroupByChange([...groupBy, key]);
  };

  const colLabel = (key) => columns.find((c) => c.key === key)?.label || key;

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[14px] font-bold text-foreground">Relatório</h2>
      </div>

      {/* Área de agrupamento */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mx-4 mt-4 px-4 py-3 rounded-lg border-2 border-dashed flex items-center gap-2 flex-wrap min-h-[48px] transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40"}`}
      >
        {groupBy.length === 0 ? (
          <p className="text-[12px] text-muted-foreground select-none">Arraste as colunas para cá para agrupar os resultados</p>
        ) : (
          groupBy.map((key) => (
            <span key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/30 text-[11px] font-semibold text-primary">
              {colLabel(key)}
              <button
                onClick={() => { onGroupByChange(groupBy.filter((k) => k !== key)); setExpanded({}); }}
                aria-label={`Remover agrupamento por ${colLabel(key)}`}
                className="hover:bg-primary/20 rounded p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/50">
          <Inbox className="w-12 h-12" />
          <p className="text-[13px]">Sem dados para exibir</p>
        </div>
      ) : (
        <div className="p-4">
          <div className="border border-border rounded-lg overflow-auto max-h-[520px]">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted">
                  {groupBy.length > 0 && <th className="w-8 border-b border-border" />}
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/report-column", c.key)}
                      style={{ minWidth: c.width || 110 }}
                      className={`px-3 py-2.5 font-semibold text-foreground border-b border-border whitespace-nowrap cursor-grab active:cursor-grabbing select-none ${c.numeric ? "text-right" : "text-left"}`}
                      title="Arraste para a área de agrupamento"
                    >
                      <span className="inline-flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                        {c.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!groups ? (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      {columns.map((c) => (
                        <td key={c.key} className={`px-3 py-2 border-b border-border whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : ""}`}>
                          {c.numeric ? fmtCell(c, r[c.key]) : String(r[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  groups.map(([gKey, gRows]) => {
                    const state = expanded[gKey];
                    const gSums = {};
                    numericCols.forEach((c) => { gSums[c.key] = gRows.reduce((s, r) => s + (+r[c.key] || 0), 0); });
                    return (
                      <React.Fragment key={gKey}>
                        <tr
                          className="bg-accent/40 hover:bg-accent/60 cursor-pointer transition-colors"
                          onClick={() => toggleGroup(gKey)}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(gKey); } }}
                          role="button"
                          aria-expanded={state === "open"}
                        >
                          <td className="px-2 py-2 border-b border-border">
                            {state === "open" ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </td>
                          <td className="px-3 py-2 border-b border-border font-semibold" colSpan={columns.length - numericCols.length}>
                            {gKey} <span className="font-normal text-muted-foreground">({gRows.length} {gRows.length === 1 ? "item" : "itens"})</span>
                          </td>
                          {numericCols.map((c) => (
                            <td key={c.key} className="px-3 py-2 border-b border-border text-right font-bold tabular-nums">
                              {fmtCell(c, gSums[c.key])}
                            </td>
                          ))}
                        </tr>
                        {state === "loading" && (
                          <tr>
                            <td colSpan={columns.length + 1} className="px-3 py-3 border-b border-border text-center text-muted-foreground text-[11px] italic">
                              Carregando...
                            </td>
                          </tr>
                        )}
                        {state === "open" && gRows.map((r, i) => (
                          <tr key={i} className="hover:bg-muted/50 transition-colors">
                            <td className="border-b border-border" />
                            {columns.map((c) => (
                              <td key={c.key} className={`px-3 py-2 border-b border-border whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : ""}`}>
                                {c.numeric ? fmtCell(c, r[c.key]) : String(r[c.key] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-muted font-bold">
                  {groupBy.length > 0 && <td className="border-t-2 border-border" />}
                  {columns.map((c, i) => (
                    <td key={c.key} className={`px-3 py-2.5 border-t-2 border-border whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : ""}`}>
                      {i === 0 && !c.numeric ? `Total (${rows.length} registros)` : c.numeric ? fmtCell(c, totals[c.key]) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}