import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Mail, Play, Pause, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function EmailAutomationConfig() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");
  const [frequency, setFrequency] = useState("15");
  const queryClient = useQueryClient();

  // Check Gmail authorization status
  const { data: gmailAuthStatus } = useQuery({
    queryKey: ["gmailAuthStatus"],
    queryFn: async () => {
      try {
        const result = await api.functions.invoke('checkGmailAuth');
        return result.data;
      } catch {
        return { authorized: false };
      }
    },
  });

  const { data: automations = [] } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.auth.isAuthenticated() ? api.asServiceRole.listAutomations() : [],
  });

  const emailAutomation = automations.find(a => a.function_name === "processIncomingEmails");

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (emailAutomation?.id) {
        return api.asServiceRole.manageAutomation({
          automation_id: emailAutomation.id,
          action: "toggle",
          automation_name: emailAutomation.name
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success(emailAutomation?.is_active ? "Automação desativada" : "Automação ativada");
    },
    onError: () => {
      toast.error("Erro ao atualizar automação");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (emailAutomation?.id) {
        return api.asServiceRole.manageAutomation({
          automation_id: emailAutomation.id,
          action: "delete",
          automation_name: emailAutomation.name
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação removida");
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast.error("Erro ao remover automação");
    }
  });

  const testMutation = useMutation({
    mutationFn: () => api.functions.invoke('processIncomingEmails'),
    onSuccess: (data) => {
      toast.success(`${data.data.processed} e-mail(s) processado(s)`);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: () => {
      toast.error("Erro ao processar e-mails");
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await api.functions.invoke('createEmailAutomation', {
        gmail_email: gmailEmail,
        frequency: frequency
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação criada com sucesso!");
      setGmailEmail("");
      setFrequency("15");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Erro ao criar automação");
    }
  });

  if (!emailAutomation) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Automação de E-mails"
          subtitle="Processe e-mails automaticamente e crie tickets"
        />
        <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>Criar Automação de E-mails</div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.1)] space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">E-mail do Gmail</label>
                <Input
                  type="email"
                  placeholder="contato@seu-email.com"
                  value={gmailEmail}
                  onChange={(e) => setGmailEmail(e.target.value)}
                  className="bg-[#111322] border-[rgba(139,92,246,0.15)] text-gray-100 placeholder:text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">E-mail do Gmail onde os tickets serão buscados na caixa de entrada</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Frequência de Verificação</label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="bg-[#111322] border-[rgba(139,92,246,0.15)]">
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1F3A] border-[rgba(139,92,246,0.15)]">
                    <SelectItem value="5">A cada 5 minutos</SelectItem>
                    <SelectItem value="10">A cada 10 minutos</SelectItem>
                    <SelectItem value="15">A cada 15 minutos</SelectItem>
                    <SelectItem value="30">A cada 30 minutos</SelectItem>
                    <SelectItem value="60">A cada 1 hora</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Intervalo de tempo entre verificações de novos e-mails</p>
              </div>

              <div className="bg-[#0B0D15] rounded-lg p-3 border border-[rgba(139,92,246,0.1)]">
                <div className="text-sm font-medium text-gray-300 mb-2">O que acontece:</div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li className="flex gap-2">
                    <span className="text-[#8B5CF6]">•</span>
                    <span>Busca e-mails não lidos na caixa de entrada do Gmail</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#8B5CF6]">•</span>
                    <span>IA extrai: assunto, cliente, urgência, descrição</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#8B5CF6]">•</span>
                    <span>Cria tickets automaticamente</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#8B5CF6]">•</span>
                    <span>Marca como lido no Gmail</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-3">
               {!gmailAuthStatus?.authorized && (
                 <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                   <Lock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                   <div className="text-sm text-yellow-200">
                     <p className="font-medium">Gmail não autorizado</p>
                     <p className="text-xs mt-1">Você precisa autorizar o acesso ao seu Gmail antes de criar a automação.</p>
                   </div>
                 </div>
               )}
               <Button
                 onClick={() => {
                   if (!gmailAuthStatus?.authorized) {
                     window.location.href = '/EmailConfigStatus';
                   } else {
                     createMutation.mutate();
                   }
                 }}
                 disabled={createMutation.isPending || (gmailAuthStatus?.authorized && (!gmailEmail || !frequency))}
                 className={`w-full sm:w-auto ${!gmailAuthStatus?.authorized ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#8B5CF6] hover:bg-[#A78BFA]'}`}
               >
                 {createMutation.isPending ? "Criando..." : !gmailAuthStatus?.authorized ? "Ir para Status de E-mail" : "Criar Automação"}
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automação de E-mails"
        subtitle="Configure como processar e-mails e criar tickets automaticamente"
      />

      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div className="flex-1">
              <div className="text-white">{emailAutomation.name}</div>
              <div className="text-xs text-gray-500 font-normal mt-1">
                {emailAutomation.description}
              </div>
            </div>
            <Switch
              checked={emailAutomation.is_active}
              onCheckedChange={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
            />
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.1)]">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Status</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${emailAutomation.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className="text-sm text-gray-300">
                  {emailAutomation.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>

            <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.1)]">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Frequência</div>
              <div className="text-sm text-gray-300">A cada 15 minutos</div>
            </div>
          </div>

          {/* Configuração */}
          <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.1)] space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">E-mail de Entrada</label>
              <Input
                value="contato@unasyshub.com.br"
                disabled
                className="bg-[#111322] border-[rgba(139,92,246,0.15)] text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">E-mails recebidos neste endereço criarão tickets automaticamente</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Período de Verificação</label>
              <Select value="7">
                <SelectTrigger className="bg-[#111322] border-[rgba(139,92,246,0.15)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1F3A] border-[rgba(139,92,246,0.15)]">
                  <SelectItem value="1">Último dia</SelectItem>
                  <SelectItem value="3">Últimos 3 dias</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">E-mails dentro deste período serão processados</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Limite de E-mails</label>
              <Input
                type="number"
                value="50"
                disabled
                className="bg-[#111322] border-[rgba(139,92,246,0.15)] text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">Máximo de e-mails processados por execução</p>
            </div>
          </div>

          {/* O que acontece */}
          <div className="bg-[#0B0D15] rounded-lg p-4 border border-[rgba(139,92,246,0.1)]">
            <div className="text-sm font-medium text-gray-300 mb-3">O que acontece:</div>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-[#8B5CF6]">•</span>
                <span>IA analisa o corpo do e-mail para extrair informações</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8B5CF6]">•</span>
                <span>Identifica cliente, tipo de ticket e urgência automaticamente</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8B5CF6]">•</span>
                <span>Cria ticket com campos preenchidos</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8B5CF6]">•</span>
                <span>Registra o e-mail no histórico do ticket</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8B5CF6]">•</span>
                <span>Marca e-mail como lido no Gmail</span>
              </li>
            </ul>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="bg-[#8B5CF6] hover:bg-[#A78BFA] gap-2"
            >
              <Play className="w-4 h-4" />
              {testMutation.isPending ? "Processando..." : "Testar Agora"}
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="destructive"
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#1C1F3A] border-[rgba(139,92,246,0.15)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover automação?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              A automação de processamento de e-mails será removida. Você pode recriar depois se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMutation.isPending ? "Removendo..." : "Remover"}
          </AlertDialogAction>
          <AlertDialogCancel className="bg-[#111322] border-[rgba(139,92,246,0.15)] text-gray-300 hover:bg-[#161830]">
            Cancelar
          </AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}