const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
const configuredTenantId = process.env.NEXT_PUBLIC_TENANT_ID;
const configuredTenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG || 'demo-store';

const tenantStorageKey = 'tenantId';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let resolvedTenantId = uuidPattern.test(configuredTenantId || '') ? configuredTenantId : undefined;
let tenantResolutionPromise;

const readStoredTenantId = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const storedTenantId = window.localStorage.getItem(tenantStorageKey);
  return storedTenantId && uuidPattern.test(storedTenantId) ? storedTenantId : undefined;
};

const storeTenantId = (tenantId) => {
  resolvedTenantId = tenantId;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(tenantStorageKey, tenantId);
  }
};

export const getFrontendTenantId = () => {
  if (resolvedTenantId) {
    return resolvedTenantId;
  }

  const storedTenantId = readStoredTenantId();

  if (storedTenantId) {
    resolvedTenantId = storedTenantId;
    return storedTenantId;
  }

  throw new Error('Tenant context is not initialized yet.');
};

export const resolveFrontendTenantId = async () => {
  if (resolvedTenantId) {
    return resolvedTenantId;
  }

  const storedTenantId = readStoredTenantId();

  if (storedTenantId) {
    resolvedTenantId = storedTenantId;
    return storedTenantId;
  }

  if (!tenantResolutionPromise) {
    tenantResolutionPromise = fetch(`${configuredApiUrl}/tenants/${encodeURIComponent(configuredTenantSlug)}`, {
      credentials: 'include'
    })
      .then(async (response) => {
        const body = await response.json().catch(() => undefined);

        if (!response.ok || body?.ok !== true || !uuidPattern.test(body.data?.tenant?.id || '')) {
          throw new Error(body?.error?.message || `Unable to resolve tenant '${configuredTenantSlug}'.`);
        }

        storeTenantId(body.data.tenant.id);
        return body.data.tenant.id;
      })
      .finally(() => {
        tenantResolutionPromise = undefined;
      });
  }

  return tenantResolutionPromise;
};

export const isTenantScopedCatalogRequest = (url = '') =>
  url.startsWith('/products') || url.startsWith('/search');

export const withTenantParams = async (params) => ({
  ...(params ?? {}),
  tenantId: params?.tenantId ?? await resolveFrontendTenantId()
});
