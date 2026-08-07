import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { MessageCircle, Send, Phone, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WhatsAppComposer({ ticket }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(ticket?.client_email?.includes("@whatsapp") ? ticket.external_customer_code || "" : "");
  const [message, setMessage] = useState("");
  const [forceSend, setForceSend] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () =>
      api.functions.invoke("sendMetabotWhatsapp", {
        ticket_id: ticket.id,
        number,
        message,
        force_send: forceSend,
      }),
    onSuccess: () => {
      setMessage("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ticketEvents", ticket.id] });
    },
  });

  const handleSend = () => {
    if (!number.trim() || !message.trim()) return;
    sendMutation.mutate();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: "rgba(37,211,102,0.1)",
          border: "1px solid rgba(37,211,102,0.25)",
          color: "#25D366",
        }}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Enviar WhatsApp
      </button>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0d1a14",
        border: "1px solid rgba(37,211,102,0.3)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(37,211,102,0.08)", borderBottom: "1px solid rgba(37,211,102,0.15)" }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
          <span className="text-sm font-semibold" style={{ color: "#25D366" }}>
            Enviar WhatsApp via Metabot
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Número */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
            <Phone className="w-3 h-3" /> Número WhatsApp
          </label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="5511999999999 (apenas dígitos, com DDD e DDI)"
            className="w-full bg-[#0B0D15] border border-[rgba(37,211,102,0.2)] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]/20"
          />
          <p className="text-[10px] text-gray-600 mt-1">Ex: 5511987654321 (Brasil + DDD + número)</p>
        </div>

        {/* Mensagem */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 block">
            Mensagem
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a mensagem..."
            rows={4}
            className="w-full bg-[#0B0D15] border border-[rgba(37,211,102,0.2)] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]/20 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-gray-600">{message.length} caracteres</p>
          </div>
        </div>

        {/* Opção force send */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={forceSend}
            onChange={(e) => setForceSend(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#25D366]"
          />
          <span className="text-xs text-gray-500">
            Force Send (enviar mesmo sem atendimento aberto no Metabot)
          </span>
        </label>

        {/* Erro */}
        {sendMutation.isError && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            {sendMutation.error?.message || "Erro ao enviar mensagem. Verifique o número e tente novamente."}
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSend}
            disabled={!number.trim() || !message.trim() || sendMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: number.trim() && message.trim() ? "#25D366" : "rgba(37,211,102,0.2)",
              color: number.trim() && message.trim() ? "white" : "rgba(37,211,102,0.5)",
              cursor: !number.trim() || !message.trim() ? "not-allowed" : "pointer",
            }}
          >
            <Send className="w-3.5 h-3.5" />
            {sendMutation.isPending ? "Enviando..." : "Enviar"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}