import { createApp } from './app';
import { env } from './config/env';
import { registerCronJobs } from './jobs/cron';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API rodando em http://localhost:${env.port} (${env.nodeEnv})`);
  registerCronJobs();
});
