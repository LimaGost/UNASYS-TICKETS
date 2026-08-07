import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";

export default function WebhookDocs() {
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = `${window.location.origin}/api/functions/createTicketFromExternal`;

  const examplePayload = {
    client_identifier: "cliente@exemplo.com",
    title: "Problema no sistema de PDV",
    description: "O sistema está apresentando erro ao finalizar vendas",
    urgency: "alta",
    ticket_type: "Suporte",
    service_mode: "reativo",
    service_type: "Suporte Técnico",
    category: "Sistema PDV",
    requester: "João Silva",
    external_order_number: "OP-2024-001",
    external_customer_code: "CLI-12345",
    external_reference: "REF-XYZ",
    external_system: "ERP Sistema X",
    dynamic_fields: {
      modulos_afetados: "PDV, NFCe",
      lojas_impactadas: "5"
    },
    attachments: [
      {
        file_url: "https://...",
        file_name: "screenshot.png",
        file_size: 102400
      }
    ]
  };

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(examplePayload, null, 2)}'`;

  const pythonExample = `import requests
import json

url = "${webhookUrl}"
payload = ${JSON.stringify(examplePayload, null, 2)}

response = requests.post(url, json=payload)
print(response.json())`;

  const phpExample = `<?php
$url = "${webhookUrl}";
$data = ${JSON.stringify(examplePayload, null, 2)};

$options = [
    'http' => [
        'header'  => "Content-type: application/json",
        'method'  => 'POST',
        'content' => json_encode($data)
    ]
];

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo $result;
?>`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integração de Sistemas Externos"
        subtitle="Documentação para criação automática de tickets via API"
      />

      {/* Endpoint */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Endpoint de Criação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg text-sm text-[#8B5CF6] font-mono">
              POST {webhookUrl}
            </code>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => copyToClipboard(webhookUrl, 'url')}
              className="border-[rgba(139,92,246,0.2)] text-gray-400 hover:text-white"
            >
              {copied === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="text-sm text-gray-400 space-y-2">
            <p>• <strong>Método:</strong> POST</p>
            <p>• <strong>Content-Type:</strong> application/json</p>
            <p>• <strong>Autenticação:</strong> Não requerida (endpoint público)</p>
          </div>
        </CardContent>
      </Card>

      {/* Campos Obrigatórios */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Campos do Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="border-l-2 border-[#EF4444] pl-4 py-2">
              <p className="text-sm font-semibold text-white">Obrigatórios</p>
              <div className="mt-2 space-y-1 text-sm text-gray-400">
                <p>• <code className="text-[#8B5CF6]">client_identifier</code> - Email ou ID do cliente</p>
                <p>• <code className="text-[#8B5CF6]">title</code> - Título do chamado</p>
              </div>
            </div>

            <div className="border-l-2 border-[#10B981] pl-4 py-2">
              <p className="text-sm font-semibold text-white">Opcionais</p>
              <div className="mt-2 space-y-1 text-sm text-gray-400">
                <p>• <code className="text-[#8B5CF6]">description</code> - Descrição detalhada</p>
                <p>• <code className="text-[#8B5CF6]">urgency</code> - baixa | media | alta | critica (padrão: media)</p>
                <p>• <code className="text-[#8B5CF6]">ticket_type</code> - Tipo de ticket (padrão: Suporte)</p>
                <p>• <code className="text-[#8B5CF6]">service_mode</code> - reativo | proativo | continuo</p>
                <p>• <code className="text-[#8B5CF6]">service_type</code> - Tipo de serviço</p>
                <p>• <code className="text-[#8B5CF6]">category</code> - Categoria</p>
                <p>• <code className="text-[#8B5CF6]">requester</code> - Nome do solicitante</p>
                <p>• <code className="text-[#8B5CF6]">external_order_number</code> - Número da OP/Pedido</p>
                <p>• <code className="text-[#8B5CF6]">external_customer_code</code> - Código do cliente</p>
                <p>• <code className="text-[#8B5CF6]">external_reference</code> - Referência genérica</p>
                <p>• <code className="text-[#8B5CF6]">external_system</code> - Nome do sistema origem</p>
                <p>• <code className="text-[#8B5CF6]">dynamic_fields</code> - Objeto com campos dinâmicos</p>
                <p>• <code className="text-[#8B5CF6]">attachments</code> - Array de anexos (file_url, file_name, file_size)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemplo de Payload */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-lg">Exemplo de Payload JSON</CardTitle>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => copyToClipboard(JSON.stringify(examplePayload, null, 2), 'json')}
            className="border-[rgba(139,92,246,0.2)] text-gray-400 hover:text-white"
          >
            {copied === 'json' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
{JSON.stringify(examplePayload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Exemplos de Código */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Exemplos de Integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* cURL */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-300">cURL</h4>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="text-gray-400 hover:text-white h-7"
              >
                {copied === 'curl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <pre className="p-4 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
{curlExample}
            </pre>
          </div>

          {/* Python */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-300">Python</h4>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => copyToClipboard(pythonExample, 'python')}
                className="text-gray-400 hover:text-white h-7"
              >
                {copied === 'python' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <pre className="p-4 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
{pythonExample}
            </pre>
          </div>

          {/* PHP */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-300">PHP</h4>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => copyToClipboard(phpExample, 'php')}
                className="text-gray-400 hover:text-white h-7"
              >
                {copied === 'php' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <pre className="p-4 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
{phpExample}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Resposta de Sucesso */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Resposta de Sucesso (201)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-[#0B0D15] border border-[rgba(139,92,246,0.1)] rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
{JSON.stringify({
  status: "success",
  ticket_id: "abc123def456",
  ticket_number: "abc123de",
  message: "Ticket criado com sucesso",
  data: {
    title: "Problema no sistema de PDV",
    status: "Aberto",
    urgency: "alta",
    expected_resolution: "2024-02-06T18:00:00.000Z"
  }
}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Erros */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Códigos de Erro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-red-400 font-mono font-semibold">400</span>
              <span className="text-gray-400">Campos obrigatórios ausentes</span>
            </div>
            <div className="flex gap-3">
              <span className="text-red-400 font-mono font-semibold">404</span>
              <span className="text-gray-400">Cliente não encontrado</span>
            </div>
            <div className="flex gap-3">
              <span className="text-red-400 font-mono font-semibold">500</span>
              <span className="text-gray-400">Erro interno do servidor</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}