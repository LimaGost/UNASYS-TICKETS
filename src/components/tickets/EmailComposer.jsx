import React, { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, X, Send, Plus, ChevronDown, ChevronUp, User, AtSign } from "lucide-react";
import { toast } from "sonner";

function RecipientTag({ email, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#8B5CF6]/20 text-[#C4B5FD] text-xs px-2 py-1 rounded-full border border-[#8B5CF6]/30">
      {email}
      <button onClick={() => onRemove(email)} className="hover:text-red-400 transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function RecipientInput({ label, values, onChange, suggestions = [] }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const filteredSuggestions = suggestions.filter(
    s => s && !values.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  const add = (email) => {
    const trimmed = email.trim();
    if (trimmed && trimmed.includes("@") && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-[#0B0D15] border border-[rgba(139,92,246,0.15)] rounded-lg cursor-text focus-within:border-[#8B5CF6]/50 transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map(email => (
          <RecipientTag key={email} email={email} onRemove={(e) => onChange(values.filter(v => v !== e))} />
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input) add(input); setTimeout(() => setShowSuggestions(false), 150); }}
          onFocus={() => input && setShowSuggestions(true)}
          placeholder={values.length === 0 ? "Digite um e-mail e pressione Enter" : ""}
          className="flex-1 min-w-[160px] bg-transparent border-none outline-none text-xs text-gray-300 placeholder-gray-600"
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#161830] border border-[rgba(139,92,246,0.25)] rounded-lg shadow-xl overflow-hidden">
          {filteredSuggestions.map(s => (
            <button
              key={s}
              onMouseDown={() => add(s)}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#1C1F3A] hover:text-white flex items-center gap-2 transition-colors"
            >
              <AtSign className="w-3 h-3 text-[#8B5CF6]" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmailComposer({ ticket, onSaved }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  // When composer opens, pre-fill client email
  useEffect(() => {
    if (open && to.length === 0 && ticket?.client_email) {
      setTo([ticket.client_email]);
    }
  }, [open]);

  // Reset when closed
  const handleClose = () => {
    setOpen(false);
    setSubject("");
    setBody("");
    setTo(ticket?.client_email ? [ticket.client_email] : []);
    setCc([]);
    setShowCc(false);
  };

  // Suggestions = client email + requester email if available
  const suggestions = [
    ticket?.client_email,
    ticket?.requester && ticket.requester.includes("@") ? ticket.requester : null,
  ].filter(Boolean);

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const email = await api.entities.TicketEmail.create({
        ticket_id: ticket.id,
        subject,
        body,
        from_email: user.email,
        from_name: user.full_name,
        to,
        cc,
        bcc: [],
        direction: "sent",
        visible_to_client: true,
      });

      await api.functions.invoke('sendEmailGmail', {
        ticket_id: ticket.id,
        to,
        cc,
        subject,
        body,
        email_record_id: email.id,
      });

      await api.entities.TicketEvent.create({
        ticket_id: ticket.id,
        type: "comment_client",
        description: `E-mail enviado para ${to.join(", ")}: "${subject}"`,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: true,
        email_sent: true,
      });

      return email;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketEmails"] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents"] });
      toast.success("E-mail enviado com sucesso!");
      onSaved?.();
      handleClose();
    },
    onError: () => {
      toast.error("Erro ao enviar e-mail. Tente novamente.");
    },
  });

  const canSend = subject.trim() && body.trim() && to.length > 0 && !sendEmailMutation.isPending;

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2 h-10"
      >
        <Mail className="w-4 h-4" />
        Novo E-mail
      </Button>
    );
  }

  return (
    <div className="border border-[rgba(139,92,246,0.3)] rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1C1F3A] border-b border-[rgba(139,92,246,0.2)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-[#A78BFA]" />
          </div>
          <span className="text-sm font-semibold text-gray-200">Novo E-mail</span>
          {ticket?.client_email && (
            <span className="text-xs text-gray-500 ml-1">· {ticket.client_name}</span>
          )}
        </div>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 bg-[#111322] space-y-3">
        {/* Quick fill client button */}
        {ticket?.client_email && !to.includes(ticket.client_email) && (
          <button
            onClick={() => setTo([...to, ticket.client_email])}
            className="flex items-center gap-2 text-xs text-[#A78BFA] hover:text-[#C4B5FD] transition-colors bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 rounded-lg px-3 py-2 w-full"
          >
            <User className="w-3.5 h-3.5" />
            Adicionar e-mail do cliente: <strong className="font-semibold">{ticket.client_email}</strong>
          </button>
        )}

        {/* To */}
        <RecipientInput
          label="Para"
          values={to}
          onChange={setTo}
          suggestions={suggestions}
        />

        {/* CC toggle */}
        <div>
          <button
            onClick={() => setShowCc(!showCc)}
            className="text-[10px] text-gray-500 hover:text-[#A78BFA] transition-colors flex items-center gap-1"
          >
            {showCc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showCc ? "Ocultar CC" : "Adicionar CC"}
          </button>
          {showCc && (
            <div className="mt-2">
              <RecipientInput
                label="CC"
                values={cc}
                onChange={setCc}
                suggestions={suggestions.filter(s => !to.includes(s))}
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[rgba(139,92,246,0.1)]" />

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Assunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto do e-mail..."
            className="w-full bg-[#0B0D15] border border-[rgba(139,92,246,0.15)] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mensagem</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            rows={7}
            className="w-full bg-[#0B0D15] border border-[rgba(139,92,246,0.15)] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/50 transition-colors resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] text-gray-600">
            {to.length > 0 ? (
              <span>Enviando para: <span className="text-gray-400">{to.join(", ")}</span></span>
            ) : (
              <span className="text-amber-500/70">Adicione pelo menos um destinatário</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-200 hover:bg-[#1C1F3A] h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={!canSend}
              size="sm"
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-1.5 h-8 text-xs disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {sendEmailMutation.isPending ? "Enviando..." : "Enviar E-mail"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}