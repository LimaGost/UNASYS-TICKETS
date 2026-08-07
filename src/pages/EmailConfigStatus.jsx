import React, { useState } from "react";
import { api } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Copy, CheckCircle2, AlertTriangle, Send, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const DOMAIN = "unasyshub.com.br";

const DNS_RECORDS = [
  {
    key: "SPF",
    type: "TXT",
    host: "@",
    value: "v=spf1 include:_spf.google.com ~all",
    desc: "Autoriza os servidores do Google a enviar e-mails em nome do seu domínio.",
  },
  {
    key: "DMARC",
    type: "TXT",
    host: "_dmarc",
    value: "v=DMARC1; p=none; rua=mailto:projetos@unasyshub.com.br; pct=100",
    desc: "Política de monitoramento (use p=none enquanto valida; depois suba para p=quarantine ou p=reject).",
  },
];

function CopyBox({ value }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copiado");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 px-3 py-2 rounded-md bg-[#0f0520] border border-[rgba(124,58,237,0.3)] text-xs text-purple-100 break-all font-mono">
        {value}
      </code>
      <Button type="button" size="sm" variant="outline" onClick={handle} className="shrink-0 border-purple-700/40 text-purple-200 hover:bg-purple-900/30">
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function DnsRow({ rec }) {
  return (
    <div className="p-4 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#150826] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-700/40 text-purple-100 border border-purple-700/60">{rec.key}</Badge>
          <span className="text-xs text-purple-300/70">Tipo: {rec.type} · Host: <span className="font-mono text-purple-100">{rec.host}</span></span>
        </div>
      </div>
      <p className="text-xs text-purple-300/70">{rec.desc}</p>
      <CopyBox value={rec.value} />
    </div>
  );
}

export default function EmailConfigStatus() {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendId, setLastSendId] = useState(null);
  const [checking, setChecking] = useState(false);
  const [recent, setRecent] = useState([]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Informe um e-mail destinatário");
      return;
    }
    setSending(true);
    try {
      const res = await api.functions.invoke("testEmailSend", {
        to: to.trim(),
        subject: `Teste TicketFlow - ${new Date().toLocaleString("pt-BR")}`,
        body: `<h2>Teste de envio</h2><p>Mensagem de validação enviada via TicketFlow em ${new Date().toLocaleString("pt-BR")}.</p><p>Se você recebeu este e-mail, a configuração SPF/DKIM/DMARC do domínio <b>${DOMAIN}</b> está OK.</p>`,
      });
      if (res?.data?.success) {
        setLastSendId(res.data.messageId);
        toast.success("E-mail enviado");
      } else {
        toast.error(res?.data?.error || "Falha ao enviar");
      }
    } catch (e) {
      toast.error(e?.message || "Erro no envio");
    } finally {
      setSending(false);
    }
  };

  const handleCheckInbox = async () => {
    setChecking(true);
    try {
      const res = await api.functions.invoke("listGmailMessages", {});
      if (res?.data?.success) {
        setRecent(res.data.emails?.slice(0, 8) || []);
        toast.success("Caixa atualizada");
      } else {
        toast.error("Falha ao ler caixa");
      }
    } catch (e) {
      toast.error(e?.message || "Erro");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F97316, #A855F7)" }}>
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-purple-100">Status de Configuração de E-mail</h1>
          <p className="text-sm text-purple-300/70">Diagnóstico de DNS e autenticação para <span className="font-mono">{DOMAIN}</span></p>
        </div>
      </div>

      {/* Alerta DMARC */}
      <Card className="bg-amber-950/30 border-amber-700/40">
        <CardContent className="pt-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90 space-y-1">
            <p className="font-semibold">Problema atual detectado: DMARC rejeitando envios</p>
            <p className="text-amber-200/70 text-xs">
              <code className="font-mono">550 5.7.26 Unauthenticated email from unasyshub.com.br is not accepted due to domain's DMARC policy</code>
            </p>
            <p className="text-xs text-amber-200/80 mt-2">
              Configure os 3 registros DNS abaixo e ative o DKIM no painel do Google Workspace para resolver.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* DKIM destacado */}
      <Card className="bg-[#1A0D2E] border-[rgba(124,58,237,0.25)]">
        <CardHeader>
          <CardTitle className="text-purple-100 text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            DKIM (gerado no Google Workspace)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-purple-300/80">
            O registro DKIM precisa ser gerado dentro do Google Workspace e copiado para o DNS.
          </p>
          <ol className="text-sm text-purple-200/90 space-y-1.5 list-decimal pl-5">
            <li>Acesse <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline inline-flex items-center gap-1">admin.google.com <ExternalLink className="w-3 h-3" /></a></li>
            <li>Apps → Google Workspace → Gmail → <b>Autenticar e-mail</b></li>
            <li>Selecione o domínio <span className="font-mono">{DOMAIN}</span> e clique em <b>Gerar novo registro</b></li>
            <li>Copie o host (<span className="font-mono">google._domainkey</span>) e o valor TXT fornecido</li>
            <li>Adicione no DNS do domínio</li>
            <li>Volte ao Admin e clique em <b>Iniciar autenticação</b></li>
          </ol>
        </CardContent>
      </Card>

      {/* SPF e DMARC */}
      <Card className="bg-[#1A0D2E] border-[rgba(124,58,237,0.25)]">
        <CardHeader>
          <CardTitle className="text-purple-100 text-base">Registros DNS para adicionar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DNS_RECORDS.map((r) => <DnsRow key={r.key} rec={r} />)}
          <p className="text-xs text-purple-300/60 mt-2">
            Após adicionar no DNS, pode levar de minutos até algumas horas para propagar. Use <a href="https://mxtoolbox.com/SuperTool.aspx" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">mxtoolbox.com</a> para validar.
          </p>
        </CardContent>
      </Card>

      {/* Teste de envio */}
      <Card className="bg-[#1A0D2E] border-[rgba(124,58,237,0.25)]">
        <CardHeader>
          <CardTitle className="text-purple-100 text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-400" />
            Teste de envio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-purple-200 text-xs">Destinatário</Label>
            <div className="flex gap-2">
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email@dominio.com"
                className="bg-[#0f0520] border-purple-800/40 text-purple-100"
              />
              <Button onClick={handleSend} disabled={sending} className="bg-gradient-to-r from-orange-500 to-purple-600 hover:opacity-90">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">Enviar</span>
              </Button>
            </div>
          </div>
          {lastSendId && (
            <div className="text-xs text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Enviado. Message ID: <span className="font-mono text-purple-200">{lastSendId}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Caixa de entrada recente */}
      <Card className="bg-[#1A0D2E] border-[rgba(124,58,237,0.25)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-purple-100 text-base">Últimos e-mails da caixa</CardTitle>
          <Button onClick={handleCheckInbox} disabled={checking} size="sm" variant="outline" className="border-purple-700/40 text-purple-200 hover:bg-purple-900/30">
            {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">Atualizar</span>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-purple-300/60 text-center py-6">Clique em "Atualizar" para carregar.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => (
                <div key={e.id} className="p-3 rounded-lg bg-[#0f0520] border border-purple-900/30">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-purple-100 truncate">{e.subject}</span>
                    <span className="text-[10px] text-purple-400/70 shrink-0">{new Date(e.date).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-xs text-purple-300/70 truncate">{e.from}</p>
                  <p className="text-xs text-purple-400/60 mt-1 line-clamp-1">{e.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}