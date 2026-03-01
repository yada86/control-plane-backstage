import { AnyApiFactory, createApiFactory, configApiRef } from '@backstage/core-plugin-api';
import { ScmAuth, scmIntegrationsApiRef, ScmIntegrationsApi } from '@backstage/integration-react';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
];
