import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, MessageCircle, Ticket, Clock, Mail, Eye, CheckCircle, AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ImplantacaoAtendimentos() {
  const { implantacao_id } = useParams();
  const navigate = useNavigate();
  const [selectedAtendimento, setSelectedAtendimento] = useState(null);

  const { data: implantacao } = useQuery({
    queryKey: ["implantacao", implantacao_id],
    queryFn: () => api.entities.ClienteImplantacao.read(implantacao_id),
    enabled: !!implantacao_id,
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ["atendimentos-vinculados", implantacao_id],
    queryFn: async () => {
      return await api.entities.WhatsAppAtendimentoVinculado.filter({
        implantacao_id: implantacao_id,
      });
    },
    enabled: !!implantacao_id,
  });

  const statusColor = {
    ativo: "bg-blue-900/30 text-blue-300",
    finalizado: "bg-gray-900/30 text-gray-300",
    ticket_criado: "bg-green-900/30 text-green-300",
  };

  const statusLabel = {
    ativo: "Ativo",
    finalizado: "Finalizado",
    ticket_criado: "Ticket Criado",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Atendimentos</h1>
          {implantacao && (
            <p className="text-sm text-gray-400 mt-1">
              {implantacao.nome_fantasia || implantacao.nome_empresa}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#161830] rounded-lg p-4 border border-[rgba(139,92,246,0.15)]">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-xs text-gray-500 uppercase">Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{atendimentos.length}</p>
        </div>
        <div className="bg-[#161830] rounded-lg p-4 border border-[rgba(139,92,246,0.15)]">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-xs text-gray-500 uppercase">Tickets</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {atendimentos.filter(a => a.ticket_id).length}
          </p>
        </div>
        <div className="bg-[#161830] rounded-lg p-4 border border-[rgba(139,92,246,0.15)]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-500 uppercase">Horas</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {atendimentos.reduce((sum, a) => sum + (a.hours_logged || 0), 0).toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Atendimentos List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Atendimentos Vinculados</h2>
        
        {atendimentos.length === 0 ? (
          <div className="bg-[#161830] rounded-lg p-8 text-center border border-[rgba(139,92,246,0.1)]">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhum atendimento vinculado</p>
          </div>
        ) : (
          atendimentos.map(atendimento => (
            <div
              key={atendimento.id}
              className="bg-[#161830] rounded-lg p-4 border border-[rgba(139,92,246,0.15)] hover:border-[rgba(139,92,246,0.3)] transition-all cursor-pointer"
              onClick={() => setSelectedAtendimento(atendimento)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white truncate">{atendimento.contact_name}</p>
                    <Badge className={`text-[10px] ${statusColor[atendimento.status]}`}>
                      {statusLabel[atendimento.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{atendimento.contact_number}</p>
                  {atendimento.notes && (
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">{atendimento.notes}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    {atendimento.hours_logged || 0}h
                  </div>
                  {atendimento.ticket_id && (
                    <div className="flex items-center gap-1 text-xs text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-1 rounded">
                      <Ticket className="w-3 h-3" />
                      {atendimento.ticket_id.slice(0, 8)}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">
                {formatDistanceToNow(new Date(atendimento.created_date), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedAtendimento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setSelectedAtendimento(null)}>
          <div className="bg-[#161830] rounded-xl max-w-2xl w-full mx-4 border border-[rgba(139,92,246,0.15)]">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{selectedAtendimento.contact_name}</h3>
                <button onClick={() => setSelectedAtendimento(null)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Telefone</p>
                  <p className="text-sm text-white font-mono">{selectedAtendimento.contact_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
                  <Badge className={`text-[10px] ${statusColor[selectedAtendimento.status]}`}>
                    {statusLabel[selectedAtendimento.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Horas Registradas</p>
                  <p className="text-sm text-white">{selectedAtendimento.hours_logged || 0} horas</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Mensagens</p>
                  <p className="text-sm text-white">{selectedAtendimento.messages_count || 0}</p>
                </div>
              </div>

              {selectedAtendimento.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2 font-semibold">Anotações</p>
                  <p className="text-sm text-gray-300 bg-[#0B0D15] rounded p-3">{selectedAtendimento.notes}</p>
                </div>
              )}

              {selectedAtendimento.ticket_id && (
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-xs text-green-400 font-semibold">Ticket Criado</p>
                    <p className="text-xs text-green-300">{selectedAtendimento.ticket_id}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedAtendimento.ticket_id && (
                  <Button
                    onClick={() => {
                      window.open(`/TicketDetail?id=${selectedAtendimento.ticket_id}`, '_blank');
                    }}
                    className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Ticket
                  </Button>
                )}
                <Button
                  onClick={() => setSelectedAtendimento(null)}
                  variant="outline"
                  className="flex-1 border-[rgba(139,92,246,0.2)]"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}