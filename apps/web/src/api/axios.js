import axios from 'axios';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const normalizeProduct = (product) => ({
  ...product,
  _id: product._id || product.id || product.slug,
  image: product.image || product.primaryImage?.url || product.images?.[0]?.url,
  price: product.price || product.minPrice || product.variants?.[0]?.price,
  category: product.category || product.categoryId,
  countInStock: product.countInStock ?? product.totalAvailable ?? product.variants?.[0]?.availableQuantity ?? 0,
  rating: product.rating ?? 0
});

const instance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true // needed for refresh token cookie
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

  response.data = payload;
  return response;
});

export default instance;
