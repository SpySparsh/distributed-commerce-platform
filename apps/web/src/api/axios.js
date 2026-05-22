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
  rating: product.rating ?? 0
});

const normalizeOrder = (order) => ({
  ...order,
  _id: order._id || order.id,
  orderItems: order.orderItems || order.items || [],
  shippingInfo: order.shippingInfo || order.shippingAddress || {},
  totalAmount: order.totalAmount,
  isDelivered: order.isDelivered ?? order.status === 'fulfilled'
});

const instance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true // needed for refresh token cookie
});

instance.interceptors.request.use(async (config) => {
  if (isTenantScopedCatalogRequest(config.url)) {
    config.params = await withTenantParams(config.params);
  }

  if (typeof window === 'undefined') {
    return config;
  }

  const token = localStorage.getItem('token');
  const csrfToken = localStorage.getItem('csrfToken');

  if (token && config.headers.Authorization === undefined) {
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

instance.interceptors.response.use((response) => {
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
});

export default instance;
