import type { Express } from 'express';
import { authGate, mountAuthRoutes } from './auth';
import { mountAgentExtras } from './agentsExtras';
import { mountAlertRoutes, setAlertBroadcast } from './alerts';
import { mountAlwaysAllowRoutes } from './alwaysAllow';
import { mountAuditExtras } from './auditExtras';
import { mountCalendarRoutes } from './calendar';
import { mountDeployRoutes } from './deploy';
import { mountDevExtras } from './devExtras';
import { mountFlowRoutes } from './flows';
import { mountGitExtras } from './gitExtras';
import { mountBackupRoutes, mountScaffoldRoutes } from './backup';
import { mountFileRoutes } from './files';
import { mountIntegrationRoutes } from './integrations';
import { mountLicenceRoutes } from './licence';
import { mountMcpRoutes } from './mcp';
import { mountRemoteRoutes } from './remote';
import { mountProjectMeta } from './projectMeta';
import { mountReportRoutes, startReportScheduler } from './reports';
import { mountSecretRoutes } from './secretStore';
import { mountTaskRoutes } from './tasks';
import { mountUsageRoutes } from './usageApi';
import { mountWebhookRoutes } from './webhooks';

/** Call once, before the other routes, so the sign-in gate sees every request first. */
export function mountOsGate(app: Express) {
  app.use(authGate);
  mountAuthRoutes(app);
}

export function mountOsRoutes(app: Express, broadcast: (d: unknown) => void) {
  setAlertBroadcast(broadcast);
  mountAlertRoutes(app);
  mountAlwaysAllowRoutes(app);
  mountAgentExtras(app);
  mountGitExtras(app);
  mountFlowRoutes(app, broadcast);
  mountDeployRoutes(app);
  mountDevExtras(app);
  mountProjectMeta(app);
  mountCalendarRoutes(app);
  mountAuditExtras(app);
  mountTaskRoutes(app);
  mountFileRoutes(app);
  mountUsageRoutes(app);
  mountReportRoutes(app);
  mountSecretRoutes(app);
  mountIntegrationRoutes(app);
  mountWebhookRoutes(app);
  mountMcpRoutes(app);
  mountRemoteRoutes(app);
  mountLicenceRoutes(app);
  mountBackupRoutes(app);
  mountScaffoldRoutes(app);
  startReportScheduler();
}
