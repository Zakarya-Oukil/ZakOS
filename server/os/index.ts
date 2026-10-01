import type { Express } from 'express';
import { authGate, mountAuthRoutes } from './auth';
import { mountAuditExtras } from './auditExtras';
import { mountBackupRoutes, mountScaffoldRoutes } from './backup';
import { mountFileRoutes } from './files';
import { mountIntegrationRoutes } from './integrations';
import { mountLicenceRoutes } from './licence';
import { mountMcpRoutes } from './mcp';
import { mountRemoteRoutes } from './remote';
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

export function mountOsRoutes(app: Express) {
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
