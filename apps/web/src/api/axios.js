import axios from 'axios';
import { isTenantScopedCatalogRequest, resolveFrontendTenantId, withTenantParams } from '../lib/tenant-context';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const normalizeProduct = (product) => ({
  ...product,
  _id: product._id || product.id,
  image: product.image || product.primaryImage?.url || product.images?.[0]?.url,
  price: product.price || product.minPrice || product.variants?.[0]?.price,
  variantId: product.variantId || product.variants?.[0]?.id,
  sku: product.sku || product.variants?.[0]?.sku,
  category: product.category || product.categoryId,
  countInStock: product.countInStock ?? product.totalAvailable ?? product.variants?.[0]?.availableQuantity ?? 0,
  rating: product.rating ?? product.averageRating ?? 0,
  averageRating: product.averageRating ?? product.rating ?? "0.00",
  reviewCount: product.reviewCount ?? 0
});

const normalizeOrder = (order) => ({
  ...order,
  _id: order._id || order.id,
  orderItems: order.orderItems || order.items || [],
  shippingInfo: order.shippingInfo || order.shippingAddress || {},
  totalAmount: order.totalAmount,
  isDelivered: order.isDelivered ?? (order.status === 'fulfilled' || order.status === 'delivered')
});

const instance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true // needed for refresh token cookie
});

const authExpiredEventName = 'ecommerce:auth-expired';
let refreshPromise;

const isAuthEndpoint = (url = '') =>
  url.startsWith('/auth/login') ||
  url.startsWith('/auth/register') ||
  url.startsWith('/auth/refresh') ||
  url.startsWith('/auth/logout');

const clearBrowserAuth = () => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('token');
  localStorage.removeItem('csrfToken');
  localStorage.removeItem('activeCartId');
};

const notifyAuthExpired = () => {
  clearBrowserAuth();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(authExpiredEventName));
  }
};

export const onAuthExpired = (handler) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(authExpiredEventName, handler);
  return () => window.removeEventListener(authExpiredEventName, handler);
};

const refreshAccessToken = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Cannot refresh auth outside the browser.');
  }

  const csrfToken = localStorage.getItem('csrfToken');

  if (!csrfToken) {
    throw new Error('Missing CSRF token.');
  }

  if (!refreshPromise) {
    refreshPromise = instance.post('/auth/refresh', { csrfToken }, { skipAuthRefresh: true })
      .then((response) => {
        const { accessToken, csrfToken: nextCsrfToken } = response.data;
        localStorage.setItem('token', accessToken);

        if (nextCsrfToken) {
          localStorage.setItem('csrfToken', nextCsrfToken);
        }

        return accessToken;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }

  return refreshPromise;
};

instance.interceptors.request.use(async (config) => {
  if (isTenantScopedCatalogRequest(config.url)) {
    config.params = await withTenantParams(config.params);
  }

  if (typeof window === 'undefined') {
    return config;
  }

  const token = localStorage.getItem('token');
  const csrfToken = localStorage.getItem('csrfToken');

  if (token && !isAuthEndpoint(config.url) && config.headers.Authorization === undefined) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (csrfToken && config.headers['x-csrf-token'] === undefined) {
    config.headers['x-csrf-token'] = csrfToken;
  }

  if (!localStorage.getItem('tenantId')) {
    await resolveFrontendTenantId();
  }

  return config;
});

const normalizeApiResponse = (response) => {
  if (response.data?.ok !== true || response.data.data === undefined) {
    return response;
  }

  const payload = response.data.data;

  if (Array.isArray(payload.items)) {
    response.data = {
      ...payload,
      products: payload.items.map(normalizeProduct)
    };
    return response;
  }

  if (payload.product !== undefined) {
    response.data = normalizeProduct(payload.product);
    return response;
  }

  if (payload.order !== undefined && payload.payment !== undefined) {
    response.data = {
      ...payload,
      order: normalizeOrder(payload.order)
    };
    return response;
  }

  if (payload.cart !== undefined) {
    response.data = payload.cart;
    return response;
  }

  if (payload.order !== undefined) {
    response.data = normalizeOrder(payload.order);
    return response;
  }

  if (Array.isArray(payload.orders)) {
    response.data = payload.orders.map(normalizeOrder);
    return response;
  }

  response.data = payload;
  return response;
};

instance.interceptors.response.use(
  normalizeApiResponse,
  async (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const originalRequest = error.config || {};

    if (
      status === 401 &&
      code === 'INVALID_SESSION' &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isAuthEndpoint(originalRequest.url || '')
    ) {
      try {
        originalRequest._retry = true;
        const token = await refreshAccessToken();
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${token}`
        };
        return instance(originalRequest);
      } catch {
        notifyAuthExpired();
      }
    }

    if (status === 401 && code === 'INVALID_SESSION' && !isAuthEndpoint(originalRequest.url || '')) {
      notifyAuthExpired();
    }

    return Promise.reject(error);
  }
);

export default instance;
