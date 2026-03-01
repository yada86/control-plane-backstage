/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import {
  coreServices,
  createBackendPlugin,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import type { Logger as WinstonLogger } from 'winston';
import runtimeRouter from './plugins/runtime';
import { backupPlugin } from './plugins/backup';

process.on('unhandledRejection', e => {
  console.error('[BACKEND] unhandledRejection', e);
});
process.on('uncaughtException', e => {
  console.error('[BACKEND] uncaughtException', e);
  process.exit(1);
});

const backend = createBackend();

const runtimePlugin = createBackendPlugin({
  pluginId: 'runtime',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.addAuthPolicy({
          path: '/events',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/resume',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/hub/paths',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/hub/file',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/hub/patch',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/hub/restore',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/checkpoints/restore',
          allow: 'unauthenticated',
        });
        httpRouter.use(
          await runtimeRouter({ logger: logger as unknown as WinstonLogger, config }),
        );
      },
    });
  },
});

const catalogConfigLocationsModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'config-locations',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        processing: catalogProcessingExtensionPoint,
      },
      async init({ config, logger, processing }) {
        const path = require('path');
        const providerPath = path.join(
          path.dirname(
            require.resolve('@backstage/plugin-catalog-backend/package.json'),
          ),
          'dist/providers/ConfigLocationEntityProvider.cjs.js',
        );
        const { ConfigLocationEntityProvider } = require(
          providerPath,
        );
        const locs = config.getOptionalConfigArray('catalog.locations') ?? [];
        logger.info(
          `[catalog-config-locations] config catalog.locations count=${locs.length}`,
        );
        for (const c of locs) {
          const ty = c.getOptionalString('type') ?? '';
          const t = c.getOptionalString('target') ?? '';
          logger.info(
            `[catalog-config-locations] location type=${ty} target=${t}`,
          );
        }
        processing.addEntityProvider(new ConfigLocationEntityProvider(config));
      },
    });
  },
});

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(catalogConfigLocationsModule);
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// See https://backstage.io/docs/permissions/getting-started for how to create your own permission policy
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

backend.add(runtimePlugin);
backend.add(backupPlugin);

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

console.log('[BACKEND] starting...');
backend.start().then(
  () => console.log('[BACKEND] started OK'),
  e => {
    console.error('[BACKEND] START FAILED', e);
    process.exit(1);
  },
);
