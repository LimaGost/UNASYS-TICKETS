// ReportDetail.jsx — v2 (staleTime:0, botão Atualizar, cargo por usuário)
import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Play, Download, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getReport } from "@/components/reports/reportConfigs";
import ReportFiltersSection from "@/components/reports/ReportFiltersSection";
import ReportGrid from "@/components/reports/ReportGrid";
import GenerateReportModal, { SKIP_MODAL_KEY } from "@/components/reports/GenerateReportModal";
import WarnToast from "@/components/reports/WarnToast";

const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export default function ReportDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const config = getReport(slug);
  const { user } = useAuth();
  const currentUserEmail = user?.email || "";
  const currentUserCargo = user?.cargo || "";

  // Filtros
  const [collapsed, setCollapsed] = useState(false);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [radioValue, setRadioValue] = useState(config?.radio?.options[0]?.value || "all");
  const [multiValues, setMultiValues] = useState({});
  const [checkboxValue, setCheckboxValue] = useState(false);

  // Resultado
  const [generated, setGenerated] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const [groupBy, setGroupBy] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("");

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["reportRows", slug, currentUserEmail, currentUserCargo],
    queryFn: () => config.fetch(currentUserEmail, currentUserCargo),
    enabled: !!config && !!currentUserEmail,
    staleTime: 0,        // sempre considera os dados desatualizados
    gcTime: 0,           // não mantém em cache após desmontar o componente
    refetchOnMount: true, // rebusca sempre que a tela monta
  });

  const multiOptions = useMemo(() => {
    const opts = {};
    (config?.filters || []).forEach((f) => {
      opts[f.key] = [...new Set(rows.map((r) => String(r[f.key] || "")).filter(Boolean))].sort();
    });
    return opts;
  }, [rows, config]);

  const dateError = useMemo(() => {
    if (dateStart && dateEnd) {
      if (new Date(dateEnd) < new Date(dateStart)) return "A data final deve ser posterior à inicial";
      if (new Date(dateEnd) - new Date(dateStart) > ONE_YEAR_MS) return "Consulta deve ser igual a um ano ou menor";
    }
    return "";
  }, [dateStart, dateEnd]);

  if (!config) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Relatório não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/Reports")}>Voltar aos relatórios</Button>
      </div>
    );
  }

  const applyFilters = () =>
    rows.filter((r) => {
      // Normaliza _date para YYYY-MM-DD ignorando fuso horario
      // (new Date("2026-07-31") em UTC-3 vira 30/07 21:00 local, quebrando o filtro)
      const rowDate = r._date ? String(r._date).slice(0, 10) : null;
      if (dateStart && rowDate && rowDate < dateStart) return false;
      if (dateEnd && rowDate && rowDate > dateEnd) return false;
      if (config.radio && !config.radio.apply(r, radioValue)) return false;
      for (const f of config.filters || []) {
        const sel = multiValues[f.key] || [];
        if (sel.length && !sel.includes(String(r[f.key] || ""))) return false;
      }
      if (checkboxValue && config.checkbox && !config.checkbox.apply(r)) return false;
      return true;
    });

  const doGenerate = () => {
    if (dateError) return;
    const filtered = applyFilters();
    setGridRows(filtered);
    setGenerated(true);
    setGroupBy([]);
    if (filtered.length === 0) {
      setToast("Não foram encontrados dados para os filtros selecionados.");
    } else {
      setToast("");
    }
  };

  const doExport = () => {
    const data = generated ? gridRows : applyFilters();
    if (data.length === 0) {
      setToast("Não foram encontrados dados para os filtros selecionados.");
      return;
    }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      config.columns.map((c) => esc(c.label)).join(";"),
      ...data.map((r) => config.columns.map((c) => esc(r[c.key])).join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${config.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleGenerateClick = () => {
    if (dateError) return;
    if (localStorage.getItem(SKIP_MODAL_KEY) === "1") doGenerate();
    else setModalOpen(true);
  };

  return (
    <div className="max-w-[1400px] pb-16">
      <div className="space-y-4">
        <ReportFiltersSection
          config={config}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          dateStart={dateStart} dateEnd={dateEnd}
          onDateStart={setDateStart} onDateEnd={setDateEnd}
          dateError={dateError}
          radioValue={radioValue} onRadioChange={setRadioValue}
          multiValues={multiValues}
          onMultiChange={(key, vals) => setMultiValues((p) => ({ ...p, [key]: vals }))}
          multiOptions={multiOptions}
          checkboxValue={checkboxValue} onCheckboxChange={setCheckboxValue}
        />

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-[12px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do relatório...
          </div>
        )}

        {generated && !isLoading && (
          <ReportGrid columns={config.columns} rows={gridRows} groupBy={groupBy} onGroupByChange={setGroupBy} />
        )}
      </div>

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 left-0 lg:left-[64px] right-0 z-30 border-t border-border bg-card px-6 py-3 flex items-center justify-end gap-2 print:hidden">
        <Button variant="ghost" onClick={() => navigate("/Reports")} className="mr-auto gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button variant="outline" disabled={!generated || gridRows.length === 0} onClick={() => window.print()} className="gap-1.5">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-1.5" title="Atualizar dados">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        <Button variant="outline" onClick={handleGenerateClick} disabled={isLoading || !!dateError} className="gap-1.5">
          <Play className="w-4 h-4" /> Gerar Relatório
        </Button>
        <Button onClick={doExport} disabled={isLoading} className="gap-1.5">
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </div>

      <GenerateReportModal open={modalOpen} onOpenChange={setModalOpen} onGenerate={doGenerate} onExport={doExport} />
      <WarnToast message={toast} onClose={() => setToast("")} />
    </div>
  );
}