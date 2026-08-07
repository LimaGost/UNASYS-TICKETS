import { Router } from 'express';
import { authenticate, requireRole, requireWebhookToken } from '../auth/middleware';
import { env } from '../config/env';

import { createNotificationHandler } from './notifications/createNotification';
import { updateTicketStatusHandler } from './tickets/updateTicketStatus';
import { createTicketFromExternalHandler } from './tickets/createTicketFromExternal';
import { recomputeTicketHoursHandler } from './tickets/recomputeTicketHours';
import { executeAutomationRulesHandler } from './automation/executeAutomationRules';
import { checkSLAAndAutomationHandler } from './automation/checkSLAAndAutomation';
import { checkSLABreachedHandler } from './automation/checkSLABreached';
import { atualizarProgressoImplantacaoHandler } from './implantacao/atualizarProgressoImplantacao';
import { avancarKanbanAposTreinamentoHandler } from './implantacao/avancarKanbanAposTreinamento';

import { checkGmailAuthHandler } from './gmail/checkGmailAuth';
import { listGmailMessagesHandler } from './gmail/listGmailMessages';
import { testEmailSendHandler } from './gmail/testEmailSend';
import { sendEmailGmailHandler } from './gmail/sendEmailGmail';
import { sendClientEmailHandler } from './gmail/sendClientEmail';
import { checkTicketEmailsHandler } from './gmail/checkTicketEmails';
import { processIncomingEmailsHandler, createEmailAutomationHandler } from './gmail/stubs';

import { fetchMetabotChatsHandler } from './metabot/fetchMetabotChats';
import { sendMetabotWhatsappHandler } from './metabot/sendMetabotWhatsapp';
import { metabotWebhookHandler } from './metabot/metabotWebhook';

import { searchKnowledgeHandler } from './knowledge/searchKnowledge';

import { getMyReportsDataHandler } from './reports/getMyReportsData';
import { exportReportCSVHandler } from './reports/exportReportCSV';
import { exportReportPDFHandler } from './reports/exportReportPDF';

import { listInternalUsersHandler } from './admin/listInternalUsers';
import { updateOwnProfileHandler } from './admin/updateOwnProfile';
import { updateUserProfileHandler } from './admin/updateUserProfile';

import { consultarStatusTicketHandler } from './crm/consultarStatusTicket';
import { receiveSalesDataHandler } from './crm/receiveSalesData';
import { testUnasysFlowHandler } from './crm/testUnasysFlow';

/**
 * Rotas de "função" (chamadas pelo frontend via api.functions.invoke('nome', payload)).
 *
 * Cada função registra sua própria rota, com o middleware de autenticação
 * apropriado (usuário logado via JWT, ou token de webhook para chamadas de
 * sistemas externos como o CRM/Metabot). Funções ainda não portadas caem no
 * catch-all no final, que responde 501 em vez de falhar silenciosamente.
 */
export const functionsRouter = Router();

// ── Tickets / SLA / Automação (Fase 2) ──────────────────────────────────
functionsRouter.post('/updateTicketStatus', authenticate, updateTicketStatusHandler);
functionsRouter.post('/recomputeTicketHours', authenticate, recomputeTicketHoursHandler);
functionsRouter.post('/executeAutomationRules', authenticate, executeAutomationRulesHandler);
functionsRouter.post('/checkSLAAndAutomation', authenticate, requireRole('admin'), checkSLAAndAutomationHandler);
functionsRouter.post('/checkSLABreached', authenticate, requireRole('admin'), checkSLABreachedHandler);
functionsRouter.post('/atualizarProgressoImplantacao', authenticate, atualizarProgressoImplantacaoHandler);
functionsRouter.post('/avancarKanbanAposTreinamento', authenticate, avancarKanbanAposTreinamentoHandler);
functionsRouter.post('/createNotification', authenticate, createNotificationHandler);

// Chamadas por sistemas externos (CRM) - não tem usuário logado, autentica
// por token compartilhado em vez de JWT.
functionsRouter.post(
  '/createTicketFromExternal',
  requireWebhookToken(env.webhookSecretToken),
  createTicketFromExternalHandler
);

// ── Gmail (Fase 3) ───────────────────────────────────────────────────────
functionsRouter.post('/checkGmailAuth', authenticate, checkGmailAuthHandler);
functionsRouter.post('/listGmailMessages', authenticate, listGmailMessagesHandler);
functionsRouter.post('/testEmailSend', authenticate, testEmailSendHandler);
functionsRouter.post('/sendEmailGmail', authenticate, sendEmailGmailHandler);
functionsRouter.post('/sendClientEmail', authenticate, sendClientEmailHandler);
functionsRouter.post('/checkTicketEmails', authenticate, checkTicketEmailsHandler);
functionsRouter.post('/processIncomingEmails', authenticate, processIncomingEmailsHandler);
functionsRouter.post('/createEmailAutomation', authenticate, requireRole('admin'), createEmailAutomationHandler);

// ── WhatsApp / Metabot (Fase 3) ──────────────────────────────────────────
functionsRouter.post('/fetchMetabotChats', authenticate, fetchMetabotChatsHandler);
functionsRouter.post('/sendMetabotWhatsapp', authenticate, sendMetabotWhatsappHandler);
// Chamado pelo servidor do Metabot (sem usuário logado) - configure o mesmo
// WEBHOOK_SECRET_TOKEN no cadastro do webhook no painel do Metabot.
functionsRouter.post('/metabotWebhook', requireWebhookToken(env.webhookSecretToken), metabotWebhookHandler);

// ── Base de Conhecimento (Fase 4) ────────────────────────────────────────
functionsRouter.post('/searchKnowledge', authenticate, searchKnowledgeHandler);

// ── Relatórios (Fase 4) ──────────────────────────────────────────────────
functionsRouter.post('/getMyReportsData', authenticate, getMyReportsDataHandler);
functionsRouter.post('/exportReportCSV', authenticate, exportReportCSVHandler);
functionsRouter.post('/exportReportPDF', authenticate, exportReportPDFHandler);

// ── Admin / Usuários (Fase 4) ────────────────────────────────────────────
functionsRouter.post('/listInternalUsers', authenticate, listInternalUsersHandler);
functionsRouter.post('/updateOwnProfile', authenticate, updateOwnProfileHandler);
functionsRouter.post('/updateUserProfile', authenticate, requireRole('admin'), updateUserProfileHandler);

// ── CRM Unasys Flow (Fase 4) ─────────────────────────────────────────────
functionsRouter.post('/consultarStatusTicket', requireWebhookToken(env.webhookSecretToken), consultarStatusTicketHandler);
functionsRouter.post('/receiveSalesData', requireWebhookToken(env.webhookSecretToken), receiveSalesDataHandler);
functionsRouter.post('/testUnasysFlow', authenticate, requireRole('admin'), testUnasysFlowHandler);

// ── Ainda não portadas (IA - Fase 7) ─────────────────────────────────────
functionsRouter.post('/:name', authenticate, (req, res) => {
  return res.status(501).json({
    error: `Função "${req.params.name}" ainda não foi portada para o novo backend (fase futura do roadmap).`,
  });
});
