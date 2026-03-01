import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { readBackupConfig } from './backup/config';
import { createBackupRouter } from './backup/router';

export const backupPlugin = createBackendPlugin({
  pluginId: 'backup',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },
      async init({ logger, httpRouter, config }) {
        httpRouter.addAuthPolicy({ path: '/status', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/snapshots', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/mirrors', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/run-mirror', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/run-snapshot', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/run-retention', allow: 'unauthenticated' });
        httpRouter.addAuthPolicy({ path: '/run-restore-test', allow: 'unauthenticated' });
        const backupCfg = readBackupConfig(config);
        httpRouter.use(await createBackupRouter({ logger, config: backupCfg }));
      },
    });
  },
});
