import cron from 'node-cron';
import { checkSLAAndAutomationCore } from '../functions/automation/checkSLAAndAutomation';
import { checkSLABreachedCore } from '../functions/automation/checkSLABreached';
import { checkTicketEmailsCore } from '../functions/gmail/checkTicketEmails';
import { gmailConfigured } from '../integrations/gmail';

/** Jobs agendados (substituem automações que antes eram configuradas pela UI). */
export function registerCronJobs() {
  // Avisos de SLA (percentual) e timeout de resposta - a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await checkSLAAndAutomationCore();
      console.log('[cron] checkSLAAndAutomation:', result);
    } catch (err) {
      console.error('[cron] Erro em checkSLAAndAutomation:', err);
    }
  });

  // Detecção de SLA estourado - a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    try {
      const result = await checkSLABreachedCore();
      console.log('[cron] checkSLABreached:', result);
    } catch (err) {
      console.error('[cron] Erro em checkSLABreached:', err);
    }
  });

  // Polling de respostas de e-mail (substitui o webhook em tempo real do
  // Gmail Pub/Sub - decisão de manter simples numa VPS própria) - a cada 5 min
  cron.schedule('*/5 * * * *', async () => {
    if (!gmailConfigured()) return; // silencioso até o usuário configurar o Gmail
    try {
      const result = await checkTicketEmailsCore();
      console.log('[cron] checkTicketEmails:', result);
    } catch (err) {
      console.error('[cron] Erro em checkTicketEmails:', err);
    }
  });

  console.log('[cron] Jobs agendados registrados (SLA 15/30min, e-mail 5min)');
}
