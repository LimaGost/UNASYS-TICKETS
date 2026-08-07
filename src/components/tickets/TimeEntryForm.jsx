import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, X, Send, Clock, ChevronDown, ChevronUp } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { api } from "@/api/apiClient";
import TimerControl from "./TimerControl";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

const TZ = "America/Sao_Paulo";

// Valores padrão do novo registro: data e horário ATUAIS (fuso de Brasília),
// minuto a minuto, com fim = início — o analista ajusta o fim real depois
// (salvar com menos de 1 minuto é bloqueado).
// Antes era fixo 08:00–09:00, o que gravava 1h indevida se ninguém mexesse.
function nowEntryDefaults() {
  const now = toZonedTime(new Date(), TZ);
  const hhmm = tzFormat(now, "HH:mm", { timeZone: TZ });
  return {
    date: tzFormat(now, "yyyy-MM-dd", { timeZone: TZ }),
    start_time: hhmm,
    end_time: hhmm,
  };
}

function calculateHours(startStr, endStr, workStart, workEnd) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const [wsh, wsm] = workStart.split(":").map(Number);
  const [weh, wem] = workEnd.split(":").map(Number);

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const wsMin = wsh * 60 + wsm;
  const weMin = weh * 60 + wem;

  if (endMin <= startMin) return { normal: 0, extra: 0, total: 0, totalMinutes: 0 };

  const totalMin = endMin - startMin;
  const overlapStart = Math.max(startMin, wsMin);
  const overlapEnd = Math.min(endMin, weMin);
  const normalMin = Math.max(0, overlapEnd - overlapStart);
  const extraMin = totalMin - normalMin;

  const normalHours = Math.round((normalMin / 60) * 100) / 100;
  const extraHours = Math.round((extraMin / 60) * 100) / 100;

  return {
    normal: normalHours,
    extra: extraHours,
    total: normalHours + extraHours,
    totalMinutes: totalMin,
    normalMinutes: normalMin,
    extraMinutes: extraMin
  };
}

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

/* ── Tag Input (chips estilo Outlook) ── */
function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const isValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const addTag = useCallback(() => {
    const val = input.trim();
    if (!val) return;
    const emails = val.split(/[;,\s]+/).map(e => e.trim()).filter(Boolean);
    const valid = emails.filter(isValid);
    onChange([...new Set([...tags, ...valid])]);
    setInput("");
  }, [input, tags, onChange]);
  const handleKeyDown = (e) => {
    if (["Enter", ",", ";", "Tab"].includes(e.key)) { e.preventDefault(); addTag(); }
    else if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center cursor-text min-h-[34px]" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded"
          style={{ background: "rgba(124,58,237,0.2)", color: "#C4B5FD", border: "1px solid rgba(124,58,237,0.35)" }}>
          {tag}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }} className="ml-0.5 text-purple-400 hover:text-white">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown} onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-[12px] text-white placeholder-gray-600"
        style={{ textTransform: "none" }} />
    </div>
  );
}

export default function TimeEntryForm({ onSave, onCancel, workStart = "08:00", workEnd = "18:00", ticket }) {
  const [form, setForm] = useState({
    ...nowEntryDefaults(),
    hour_type: "normal",
    description: "",
    attachments: [],
  });
  const [hours, setHours] = useState({ normal: 0, extra: 0 });
  const [durationError, setDurationError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const quillRef = useRef(null);

  useEffect(() => {
    const calculated = calculateHours(form.start_time, form.end_time, workStart, workEnd);
    setHours(calculated);
    if (calculated.totalMinutes >= 1) setDurationError(false);
  }, [form.start_time, form.end_time, workStart, workEnd]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        setUploading(true);
        const { file_url } = await api.integrations.Core.UploadFile({ file: blob });
        setUploading(false);
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", file_url);
          quill.setSelection(range.index + 1);
        }
      }
    }
  };

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setUploading(false);
    set("attachments", [...form.attachments, { url: file_url, name: file.name, size: file.size }]);
  };

  const removeAttachment = (idx) => {
    set("attachments", form.attachments.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    // Bloqueia registros com menos de 1 minuto: o padrão do formulário é
    // início = agora / fim = agora+1s, então salvar sem ajustar o Fim
    // gravaria um apontamento de 0h. Exigimos o horário real de término.
    if (!hours.totalMinutes || hours.totalMinutes < 1) {
      setDurationError(true);
      return;
    }
    setDurationError(false);
    onSave({ ...form, calculatedHours: hours });
    setForm({
      ...nowEntryDefaults(),
      hour_type: "normal",
      description: "",
      attachments: [],
    });
  };

  const handleTimeComplete = (timerData) => {
    setForm(prev => ({
      ...prev,
      date: timerData.date,
      start_time: timerData.start_time,
      end_time: timerData.end_time,
    }));
  };

  return (
    <div className="space-y-4">
      <TimerControl ticketId={ticket?.id} onTimeComplete={handleTimeComplete} />

      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label className="text-gray-500 text-xs mb-1.5 block">Data</Label>
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
            className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white h-9 text-sm" />
        </div>
        <div>
          <Label className="text-gray-500 text-xs mb-1.5 block">Início</Label>
          <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
            className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white h-9 text-sm" />
        </div>
        <div>
          <Label className="text-gray-500 text-xs mb-1.5 block">Fim</Label>
          <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)}
            className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white h-9 text-sm" />
        </div>
        <div>
          <Label className="text-gray-500 text-xs mb-1.5 block">Tipo</Label>
          <Select value={form.hour_type} onValueChange={(v) => set("hour_type", v)}>
            <SelectTrigger className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
              <SelectItem value="normal" className="text-gray-200">Normal</SelectItem>
              <SelectItem value="interna" className="text-gray-200">Interna</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#10B981]/10 via-[#06B6D4]/10 to-[#8B5CF6]/10 border border-[rgba(16,185,129,0.3)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#34D399]" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contabilização de Horas</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0B0D15]/60 rounded-lg p-3 border border-[rgba(16,185,129,0.2)]">
            <p className="text-[10px] text-gray-500 mb-1">Normal</p>
            <p className="text-xl font-bold text-[#34D399]">{formatTime(hours.normal)}</p>
            <p className="text-[9px] text-gray-600 mt-1">{hours.normalMinutes || 0} minutos</p>
          </div>
          <div className="bg-[#0B0D15]/60 rounded-lg p-3 border border-[rgba(6,182,212,0.2)]">
            <p className="text-[10px] text-gray-500 mb-1">Extra</p>
            <p className="text-xl font-bold text-[#22D3EE]">{formatTime(hours.extra)}</p>
            <p className="text-[9px] text-gray-600 mt-1">{hours.extraMinutes || 0} minutos</p>
          </div>
          <div className="bg-[#0B0D15]/60 rounded-lg p-3 border border-[rgba(139,92,246,0.2)]">
            <p className="text-[10px] text-gray-500 mb-1">Total</p>
            <p className="text-xl font-bold text-[#A78BFA]">{formatTime(hours.total || 0)}</p>
            <p className="text-[9px] text-gray-600 mt-1">{hours.totalMinutes || 0} minutos</p>
          </div>
        </div>
        {form.hour_type === "interna" && (
          <div className="mt-3 p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-md">
            <p className="text-xs text-[#F59E0B] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
              Hora interna - Registrada normalmente no total do chamado (não cobrada do cliente)
            </p>
          </div>
        )}
      </div>

      <div>
        <Label className="text-gray-500 text-xs mb-2 block">Relato da Atividade</Label>
        <div onPaste={handlePaste} className="bg-[#111322] border border-[rgba(139,92,246,0.2)] rounded-lg overflow-hidden" style={{ minHeight: "240px" }}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={form.description}
            onChange={(v) => set("description", v)}
            placeholder="Descreva detalhadamente o trabalho realizado... (Cole imagens diretamente com Ctrl+V)"
            modules={{
              toolbar: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline", "strike"],
                [{ list: "ordered" }, { list: "bullet" }],
                [{ color: [] }, { background: [] }],
                ["link", "image"],
                ["clean"],
              ],
            }}
            style={{ backgroundColor: "#111322", color: "white", border: "none" }}
          />
        </div>
        {uploading && (
          <div className="flex items-center gap-2 mt-2 text-xs text-[#8B5CF6]">
            <div className="w-3 h-3 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
            Fazendo upload da imagem...
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-gray-500 text-xs">Anexos</Label>
          <label>
            <input type="file" className="hidden" onChange={handleFileAttach} />
            <Button size="sm" variant="outline" className="h-7 text-xs border-[rgba(139,92,246,0.2)] text-gray-400 hover:text-white" asChild>
              <span className="cursor-pointer gap-1.5">
                <Paperclip className="w-3 h-3" />
                Anexar
              </span>
            </Button>
          </label>
        </div>
        {form.attachments.length > 0 && (
          <div className="space-y-1.5">
            {form.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded bg-[#0B0D15] border border-[rgba(139,92,246,0.08)]">
                <Paperclip className="w-3 h-3 text-gray-600" />
                <span className="flex-1 text-xs text-gray-400 truncate">{att.name}</span>
                <button onClick={() => removeAttachment(idx)} className="text-gray-600 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(139,92,246,0.1)]">
        {durationError && (
          <p className="text-xs text-red-400 mr-auto">
            ⚠️ Ajuste o horário de <strong>Fim</strong> — o registro precisa ter pelo menos 1 minuto.
          </p>
        )}
        <Button size="sm" onClick={() => setShowEmailPanel(!showEmailPanel)}
          variant="outline"
          className="border-[rgba(139,92,246,0.2)] text-gray-400 hover:text-white h-9 text-xs gap-1.5 px-4">
          {showEmailPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          {showEmailPanel ? "Ocultar Email" : "Enviar Email"}
        </Button>
        <Button size="sm" onClick={handleSubmit}
          className="bg-[#10B981] hover:bg-[#059669] text-white h-9 text-xs px-6">
          Salvar Registro
        </Button>
      </div>

      {showEmailPanel && (
        <EmailPanel
          ticket={ticket}
          formData={form}
          onSend={(emailData) => {
            onSave({ ...form, calculatedHours: hours, emailData });
            setShowEmailPanel(false);
          }}
        />
      )}
    </div>
  );
}

function EmailPanel({ ticket, formData, onSend }) {
  const [emailForm, setEmailForm] = useState({
    to: ticket?.client_email ? [ticket.client_email] : [],
    cc: [],
    bcc: [],
    subject: `Atualização - Chamado #${ticket?.id?.slice(0, 8)} - ${ticket?.title || ""}`,
    body: formData?.description || "",
  });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const set = (k, v) => setEmailForm(prev => ({ ...prev, [k]: v }));

  const handleSend = () => {
    onSend({
      ...emailForm,
      to: emailForm.to.join(","),
      cc: emailForm.cc.join(","),
      bcc: emailForm.bcc.join(","),
    });
  };

  const FieldRow = ({ label, children, extra }) => (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b" style={{ borderColor: "rgba(124,58,237,0.1)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider w-12 flex-shrink-0 pt-1.5"
        style={{ color: "rgba(168,85,247,0.55)" }}>{label}</span>
      <div className="flex-1">{children}</div>
      {extra}
    </div>
  );

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,58,237,0.2)", background: "#0A0815" }}>
      {/* Título */}
      <div className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "rgba(124,58,237,0.1)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
        <Send className="w-3.5 h-3.5" style={{ color: "#A855F7" }} />
        <span className="text-[12px] font-semibold text-white">Notificar cliente por e-mail ✓</span>
      </div>

      {/* Para */}
      <FieldRow label="Para"
        extra={
          <div className="flex items-center gap-1 pt-1 flex-shrink-0">
            {!showCc && <button onClick={() => setShowCc(true)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "rgba(168,85,247,0.7)" }}>Cc</button>}
            {!showBcc && <button onClick={() => setShowBcc(true)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "rgba(168,85,247,0.7)" }}>Cco</button>}
          </div>
        }>
        <TagInput tags={emailForm.to} onChange={v => set("to", v)} placeholder="Destinatário (Enter para confirmar)" />
      </FieldRow>

      {/* CC */}
      {showCc && (
        <FieldRow label="Cc"
          extra={<button onClick={() => { setShowCc(false); set("cc", []); }} className="pt-1.5 text-gray-600 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}>
          <TagInput tags={emailForm.cc} onChange={v => set("cc", v)} placeholder="Cc (Enter para confirmar)" />
        </FieldRow>
      )}

      {/* BCC */}
      {showBcc && (
        <FieldRow label="Cco"
          extra={<button onClick={() => { setShowBcc(false); set("bcc", []); }} className="pt-1.5 text-gray-600 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}>
          <TagInput tags={emailForm.bcc} onChange={v => set("bcc", v)} placeholder="Cco (Enter para confirmar)" />
        </FieldRow>
      )}

      {/* Assunto */}
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider w-12 flex-shrink-0" style={{ color: "rgba(168,85,247,0.55)" }}>Assunto</span>
        <input value={emailForm.subject} onChange={e => set("subject", e.target.value)}
          placeholder="Assunto" className="flex-1 bg-transparent outline-none text-[12px] text-white placeholder-gray-600"
          style={{ textTransform: "none" }} />
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <div className="bg-[#0D0818] border border-[rgba(139,92,246,0.15)] rounded-lg overflow-hidden" style={{ minHeight: 160 }}>
          <ReactQuill theme="snow" value={emailForm.body} onChange={v => set("body", v)}
            placeholder="Mensagem para o cliente..."
            modules={{ toolbar: [[{ header: [1, 2, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"], ["clean"]] }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: "1px solid rgba(124,58,237,0.1)", background: "rgba(124,58,237,0.05)" }}>
        <span className="text-[11px] text-gray-600">
          {emailForm.to.length > 0 && <span>Para: <span className="text-purple-400">{emailForm.to.length} destinatário{emailForm.to.length > 1 ? "s" : ""}</span></span>}
          {emailForm.cc.length > 0 && <span> · Cc: <span className="text-purple-400">{emailForm.cc.length}</span></span>}
        </span>
        <Button size="sm" onClick={handleSend}
          disabled={emailForm.to.length === 0 || !emailForm.subject}
          className="h-9 px-5 gap-2 font-semibold"
          style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "white" }}>
          <Send className="w-3.5 h-3.5" />
          Salvar e Enviar E-mail
        </Button>
      </div>
    </div>
  );
}