import React, { useState } from "react";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Loader2, Sparkles, ArrowRight, RefreshCw, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function EmailItem({ email, onSelect, selected }) {
  const senderName = email.from.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '') || email.from;
  const senderEmail = (email.from.match(/<(.+?)>/) || [])[1] || email.from;

  return (
    <div
      onClick={() => onSelect(email)}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selected?.id === email.id
          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
          : 'border-[rgba(139,92,246,0.15)] bg-[#111322] hover:border-[rgba(139,92,246,0.4)] hover:bg-[#1C1F3A]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[#A78BFA] text-sm font-bold">{senderName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white text-sm font-medium truncate">{senderName}</span>
            <span className="text-gray-500 text-xs flex-shrink-0">
              {email.date ? format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR }) : ''}
            </span>
          </div>
          <p className="text-gray-300 text-sm font-medium truncate mt-0.5">{email.subject}</p>
          <p className="text-gray-500 text-xs truncate mt-0.5">{email.snippet}</p>
          <p className="text-gray-600 text-xs mt-1">{senderEmail}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmailToTicketModal({ open, onOpenChange, onTicketPrefilled }) {
  const [step, setStep] = useState('list'); // list | parsing | preview
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [emailMeta, setEmailMeta] = useState(null);

  const loadEmails = async () => {
    setLoadingEmails(true);
    const res = await api.functions.invoke('listGmailMessages', {});
    setEmails(res.data?.emails || []);
    setLoadingEmails(false);
    setStep('list');
  };

  React.useEffect(() => {
    if (open) loadEmails();
  }, [open]);

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
  };

  const handleParse = async () => {
    if (!selectedEmail) return;
    setParsing(true);
    setStep('parsing');
    const res = await api.functions.invoke('parseEmailToTicket', { messageId: selectedEmail.id });
    setExtracted(res.data?.extracted || {});
    setEmailMeta(res.data?.email || {});
    setParsing(false);
    setStep('preview');
  };

  const handleUseData = () => {
    onTicketPrefilled({
      title: extracted.title || '',
      description: extracted.description || '',
      requester: extracted.requester || '',
      urgency: extracted.urgency || 'media',
      client_id: extracted.client_id || '',
      ticket_type: extracted.suggested_ticket_type || '',
      service_type: extracted.suggested_service_type || '',
      main_type: extracted.main_type || 'suporte',
    });
    onOpenChange(false);
    setStep('list');
    setSelectedEmail(null);
    setExtracted(null);
  };

  const urgencyColors = {
    baixa: 'bg-blue-500/20 text-blue-400',
    media: 'bg-yellow-500/20 text-yellow-400',
    alta: 'bg-orange-500/20 text-orange-400',
    critica: 'bg-red-500/20 text-red-400',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setStep('list'); setSelectedEmail(null); setExtracted(null); } }}>
      <DialogContent className="bg-[#161830] border-[rgba(139,92,246,0.2)] text-gray-100 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#A78BFA]" />
            Criar Ticket a partir de E-mail
          </DialogTitle>
        </DialogHeader>

        {/* STEP: LIST */}
        {step === 'list' && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">Selecione um e-mail não lido para criar um ticket</p>
              <Button size="sm" variant="ghost" onClick={loadEmails} disabled={loadingEmails}
                className="text-gray-400 hover:text-white gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingEmails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
                <span className="ml-3 text-gray-400">Carregando e-mails...</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum e-mail não lido encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {emails.map(email => (
                  <EmailItem key={email.id} email={email} onSelect={handleSelectEmail} selected={selectedEmail} />
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-[rgba(139,92,246,0.1)]">
              <Button variant="outline" onClick={() => onOpenChange(false)}
                className="border-[rgba(139,92,246,0.2)] text-gray-400">
                Cancelar
              </Button>
              <Button disabled={!selectedEmail} onClick={handleParse}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2">
                <Sparkles className="w-4 h-4" />
                Analisar com IA
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP: PARSING */}
        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#A78BFA]" />
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6] absolute -top-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">IA analisando o e-mail...</p>
              <p className="text-gray-500 text-sm mt-1">Extraindo informações para pré-preencher o ticket</p>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && extracted && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
              <Sparkles className="w-4 h-4 text-[#A78BFA] flex-shrink-0" />
              <p className="text-[#A78BFA] text-sm">{extracted.summary || "IA extraiu as informações do e-mail."}</p>
            </div>

            {/* Email meta */}
            <div className="rounded-lg bg-[#111322] border border-[rgba(139,92,246,0.1)] p-3 space-y-1.5">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">E-mail Original</p>
              <div className="flex gap-2 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">De:</span>
                <span className="text-gray-300">{emailMeta?.from}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Assunto:</span>
                <span className="text-gray-300">{emailMeta?.subject}</span>
              </div>
              {emailMeta?.attachments?.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-500 w-16 flex-shrink-0">Anexos:</span>
                  <div className="flex flex-wrap gap-1">
                    {emailMeta.attachments.map((a, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs bg-[#1C1F3A] px-2 py-0.5 rounded text-gray-400">
                        <Paperclip className="w-3 h-3" /> {a.filename}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Extracted fields */}
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Dados Extraídos pela IA</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Título</p>
                  <p className="text-white text-sm font-medium">{extracted.title}</p>
                </div>
                <div className="bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Solicitante</p>
                  <p className="text-white text-sm">{extracted.requester || '—'}</p>
                </div>
                <div className="bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Urgência</p>
                  <Badge className={urgencyColors[extracted.urgency] + ' capitalize'}>
                    {extracted.urgency}
                  </Badge>
                </div>
                <div className="bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Cliente Sugerido</p>
                  <p className="text-white text-sm">{extracted.client_name || '—'}</p>
                </div>
                <div className="bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Tipo de Ticket</p>
                  <p className="text-white text-sm">{extracted.suggested_ticket_type || '—'}</p>
                </div>
                <div className="col-span-2 bg-[#111322] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Descrição</p>
                  <p className="text-gray-300 text-sm line-clamp-4">{extracted.description}</p>
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-xs">Os dados serão pré-preenchidos no formulário. Você poderá revisar e ajustar antes de criar.</p>

            <div className="flex justify-between gap-3 pt-2 border-t border-[rgba(139,92,246,0.1)]">
              <Button variant="ghost" onClick={() => setStep('list')}
                className="text-gray-400 hover:text-white">
                ← Voltar
              </Button>
              <Button onClick={handleUseData}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2">
                <ArrowRight className="w-4 h-4" />
                Usar estes dados e abrir formulário
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}