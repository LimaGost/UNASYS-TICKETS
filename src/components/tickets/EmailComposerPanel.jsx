import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, X, Send, Paperclip, Minimize2, Maximize2, AlertCircle } from "lucide-react";
import RichEditor from "./RichEditor";
import { toast } from "sonner";

/* ── Tag Input (chips estilo Outlook) ── */
function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const isValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const addTag = useCallback(() => {
    const val = input.trim();
    if (!val) return;
    const valid = val.split(/[;,\s]+/).map(e => e.trim()).filter(Boolean).filter(isValid);
    onChange([...new Set([...tags, ...valid])]);
    setInput("");
  }, [input, tags, onChange]);
  const handleKeyDown = (e) => {
    if (["Enter", ",", ";", "Tab"].includes(e.key)) { e.preventDefault(); addTag(); }
    else if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center cursor-text min-h-[36px]" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded bg-primary/15 text-primary border border-primary/25">
          {tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }} className="ml-0.5 text-primary/70 hover:text-foreground">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[140px] bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground"
        style={{ textTransform: "none" }} />
    </div>
  );
}

/* ── Row de campo ── */
function FieldRow({ label, children, borderBottom = true }) {
  return (
    <div className={`flex items-start gap-3 px-5 py-2.5 ${borderBottom ? "border-b border-border" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider pt-1.5 w-10 flex-shrink-0 text-primary/60">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function EmailComposerPanel({ ticket }) {
  const queryClient = useQueryClient();
  const quillRef = useRef(null);
  const fileRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [uploading, setUploading] = useState(false);

  const defaultForm = () => ({
    to: ticket?.client_email ? [ticket.client_email] : [],
    cc: [], bcc: [],
    subject: `Atualização - ${ticket?.title || ""}`,
    body: "", attachments: [],
  });
  const [form, setForm] = useState(defaultForm);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    fileRef.current.value = "";
    setUploading(true);
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        return { url: file_url, name: file.name, size: file.size };
      })
    );
    setUploading(false);
    set("attachments", [...form.attachments, ...uploaded]);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        setUploading(true);
        const { file_url } = await api.integrations.Core.UploadFile({ file: blob });
        setUploading(false);
        const quill = quillRef.current?.getEditor();
        if (quill) { const range = quill.getSelection(true); quill.insertEmbed(range.index, "image", file_url); quill.setSelection(range.index + 1); }
      }
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const user = await api.auth.me();
      if (form.to.length === 0) throw new Error("Adicione ao menos um destinatário");

      // Criar registro do e-mail
      let emailRecord = null;
      try {
        emailRecord = await api.entities.TicketEmail.create({
          ticket_id: ticket?.id, direction: "sent", from_email: user.email, from_name: user.full_name,
          to: form.to, cc: form.cc, bcc: form.bcc, subject: form.subject, body: form.body,
          attachments: form.attachments.map(a => ({ file_url: a.url, file_name: a.name, mime_type: a.type || "" })),
        });
      } catch (e) {
        console.error("Erro ao criar registro TicketEmail:", e);
        // Continua mesmo sem salvar o registro — o envio ainda funciona
      }

      // Enviar via Gmail para cada destinatário
      const errors = [];
      for (const recipient of form.to) {
        const res = await api.functions.invoke("sendEmailGmail", {
          ticket_id: ticket?.id,
          to: recipient,
          cc: form.cc,
          bcc: form.bcc,
          subject: form.subject,
          body: form.body,
          attachments: form.attachments.map(a => a.url),
          email_record_id: emailRecord?.id || null,
          // Fallback: se o TicketEmail não foi criado pelo frontend (RLS), cria via service role no backend
          save_record: !emailRecord ? { from_email: user.email, from_name: user.full_name } : null,
        });
        if (res.data?.error) {
          errors.push(`${recipient}: ${res.data.error}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Falha no envio para: ${errors.join("; ")}`);
      }

      // Criar evento no ticket
      await api.entities.TicketEvent.create({
        ticket_id: ticket?.id, type: "comment_client",
        description: `E-mail enviado para: ${form.to.join(", ")}${form.cc.length ? " | CC: " + form.cc.join(", ") : ""}`,
        user_email: user.email, user_name: user.full_name, visible_to_client: true,
      });
    },
    onSuccess: () => {
      toast.success("E-mail enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ticketEvents", ticket?.id] });
      queryClient.invalidateQueries({ queryKey: ["ticketEmails", ticket?.id] });
      setForm(defaultForm()); setShowCc(false); setShowBcc(false); setIsOpen(false);
    },
    onError: (err) => {
      toast.error(`Erro ao enviar e-mail: ${err.message}`);
      console.error("Erro sendEmailGmail:", err);
    },
  });

  const canSend = form.to.length > 0 && form.subject.trim();

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="gap-2 h-9 rounded-lg" size="sm">
        <Mail className="w-4 h-4" /> Enviar E-mail
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className={`pointer-events-auto flex flex-col shadow-2xl transition-all duration-200 bg-card border border-border ${maximized ? "fixed inset-4 rounded-2xl" : "w-full max-w-2xl rounded-2xl"}`}
        style={{ maxHeight: maximized ? "100%" : "86vh" }}>

        {/* Título */}
        <div className="flex items-center px-5 py-3 flex-shrink-0 select-none bg-muted/50 border-b border-border rounded-t-2xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Mail className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-[13px] font-semibold text-foreground truncate">{form.subject || "Nova mensagem"}</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setMaximized(v => !v)} className="w-7 h-7 flex items-center justify-center rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted">
              {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="w-7 h-7 flex items-center justify-center rounded transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Campos cabeçalho */}
        <div className="flex-shrink-0 bg-card">
          <FieldRow label="Para">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <TagInput tags={form.to} onChange={v => set("to", v)} placeholder="Destinatário (Enter para confirmar)" />
              </div>
              <div className="flex items-center gap-1 pt-1 flex-shrink-0">
                {!showCc && <button onClick={() => setShowCc(true)} className="text-[11px] px-2 py-0.5 rounded text-primary/60 hover:text-primary transition-colors">Cc</button>}
                {!showBcc && <button onClick={() => setShowBcc(true)} className="text-[11px] px-2 py-0.5 rounded text-primary/60 hover:text-primary transition-colors">Cco</button>}
              </div>
            </div>
          </FieldRow>
          {showCc && (
            <FieldRow label="Cc">
              <div className="flex items-start gap-2">
                <div className="flex-1"><TagInput tags={form.cc} onChange={v => set("cc", v)} placeholder="Cc (Enter para confirmar)" /></div>
                <button onClick={() => { setShowCc(false); set("cc", []); }} className="pt-1.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            </FieldRow>
          )}
          {showBcc && (
            <FieldRow label="Cco">
              <div className="flex items-start gap-2">
                <div className="flex-1"><TagInput tags={form.bcc} onChange={v => set("bcc", v)} placeholder="Cco (Enter para confirmar)" /></div>
                <button onClick={() => { setShowBcc(false); set("bcc", []); }} className="pt-1.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            </FieldRow>
          )}
          <FieldRow label="Assunto" borderBottom={false}>
            <input value={form.subject} onChange={e => set("subject", e.target.value)} placeholder="Assunto"
              className="w-full bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground py-0.5"
              style={{ textTransform: "none" }} />
          </FieldRow>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0 border-t border-b border-border bg-muted/30">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileAttach} multiple />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted">
            <Paperclip className="w-3.5 h-3.5" />
            {uploading ? "Enviando..." : "Anexar"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-card" onPaste={handlePaste} style={{ minHeight: 0 }}>
          <RichEditor ref={quillRef} value={form.body} onChange={v => set("body", v)} placeholder="Escreva sua mensagem aqui... (Cole imagens com Ctrl+V)" />
        </div>

        {/* Anexos */}
        {form.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 flex-shrink-0 border-t border-border bg-muted/20">
            {form.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <Paperclip className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{att.name}</span>
                <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>
                <button onClick={() => set("attachments", form.attachments.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Erro */}
        {sendMutation.isError && (
          <div className="mx-5 mb-2 flex items-center gap-2 text-[12px] text-destructive p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {sendMutation.error?.message || "Erro ao enviar e-mail"}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-t border-border bg-muted/30 rounded-b-2xl">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {form.to.length > 0 && <span>Para: <span className="text-primary">{form.to.length} destinatário{form.to.length > 1 ? "s" : ""}</span></span>}
            {form.cc.length > 0 && <span>· Cc: <span className="text-primary">{form.cc.length}</span></span>}
          </div>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !canSend} className="gap-2 h-9 font-semibold min-w-[120px]">
            {sendMutation.isPending ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            {sendMutation.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}