import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/shared/PageHeader";
import { MessageCircle, ArrowLeft, Sparkles, Clock } from "lucide-react";

export default function MetabotConfig() {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="WhatsApp / Metabot"
        subtitle="Integração com Metabot para atendimento e triagem via WhatsApp"
      />

      {/* Breadcrumb / voltar */}
      <Link
        to="/Settings"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para Configurações
      </Link>

      {/* Em breve - empty state elegante */}
      <div
        className="relative rounded-2xl p-10 md:p-16 text-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.05), rgba(124,58,237,0.05))",
          border: "1px solid rgba(139,92,246,0.15)",
        }}
      >
        {/* glow decorativo */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #22c55e, transparent)" }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        />

        <div className="relative">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: "linear-gradient(135deg, #22c55e, #7c3aed)",
              boxShadow: "0 8px 32px rgba(34,197,94,0.3)",
            }}
          >
            <MessageCircle className="w-8 h-8 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">Em breve</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Integração com Metabot
          </h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            Esta área permitirá conectar o sistema ao Metabot para criar tickets a partir
            de conversas no WhatsApp, transferir atendimentos e sincronizar histórico.
          </p>

          {/* Preview de recursos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8 max-w-2xl mx-auto">
            {[
              { label: "Token do Metabot", desc: "Autenticação segura da API" },
              { label: "Webhook configurável", desc: "Receba mensagens em tempo real" },
              { label: "WhatsApp vinculado", desc: "Atendimento centralizado" },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl text-left"
                style={{
                  background: "rgba(20,10,40,0.6)",
                  border: "1px solid rgba(139,92,246,0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <p className="text-[12px] font-semibold text-gray-200">{item.label}</p>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-8">
            Enquanto isso, a integração base do Metabot já está funcionando via webhook backend.
          </p>
        </div>
      </div>
    </div>
  );
}