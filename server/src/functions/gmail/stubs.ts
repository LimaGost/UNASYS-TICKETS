import type { Request, Response } from 'express';

/** processIncomingEmails usaria IA para criar tickets automaticamente a
 * partir de e-mails de remetentes desconhecidos. IA foi adiada para a Fase 7
 * (decisão do usuário) - por enquanto isso só explica a situação em vez de
 * falhar silenciosamente. checkTicketEmails já cobre o caso mais comum
 * (resposta a um ticket existente) sem precisar de IA. */
export async function processIncomingEmailsHandler(_req: Request, res: Response) {
  return res.status(501).json({
    error:
      'processIncomingEmails depende de IA para criar tickets a partir de e-mails de remetentes desconhecidos - isso foi adiado para a Fase 7. Use checkTicketEmails para respostas em tickets existentes.',
  });
}

/** Essa função antes criava um agendamento configurável pela UI. Nesta
 * stack, o agendamento é fixo em código (server/src/jobs/cron.ts), então não
 * há mais nada para "criar" aqui - a tela de configuração pode ser
 * simplificada para só mostrar o intervalo fixo. */
export async function createEmailAutomationHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'O agendamento agora é fixo via cron no servidor (não precisa mais ser configurado pela UI).',
  });
}
