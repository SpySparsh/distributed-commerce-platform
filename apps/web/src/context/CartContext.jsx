import { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axios';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const cartStorageKey = 'activeCartId';

const toLegacyCartItems = (cart) =>
  (cart?.items ?? []).map((item) => ({
    _id: item.variantId,
    productId: item.productId,
    variantId: item.variantId,
    name: item.name || item.sku || item.variantId,
    sku: item.sku,
    qty: item.quantity,
    price: Number(item.unitPrice),
    unitPrice: item.unitPrice,
    currency: item.currency,
    countInStock: 99
  }));

export const CartProvider = ({ children }) => {
  const { isAuthenticated, isHydrating } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartId, setCartId] = useState(null);

  const persistCart = (nextCart) => {
    setCart(toLegacyCartItems(nextCart));
    setCartId(nextCart.id);
    localStorage.setItem(cartStorageKey, nextCart.id);
  };

  const getOrCreateCart = async () => {
    if (!isAuthenticated) {
      throw new Error('Please login to use your cart.');
    }

    const storedCartId = localStorage.getItem(cartStorageKey);

    if (storedCartId) {
      try {
        const res = await axios.get(`/carts/${storedCartId}`);
        persistCart(res.data);
        return res.data;
      } catch {
        localStorage.removeItem(cartStorageKey);
      }
    }

    const res = await axios.post('/carts');
    persistCart(res.data.cart ?? res.data);
    return res.data.cart ?? res.data;
  };

  const createFreshCart = async () => {
    if (!isAuthenticated) {
      throw new Error('Please login to use your cart.');
    }

    localStorage.removeItem(cartStorageKey);
    const res = await axios.post('/carts');
    const nextCart = res.data.cart ?? res.data;
    persistCart(nextCart);
    return nextCart;
  };

  const refreshCartById = async (nextCartId) => {
    const res = await axios.get(`/carts/${nextCartId}`);
    const nextCart = res.data.cart ?? res.data;
    persistCart(nextCart);
    return nextCart;
  };

  const fetchCart = async () => {
    try {
      await getOrCreateCart();
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Fetch cart error:', err.response?.data || err.message);
      }
    }
  };

  const resolveProductForCart = async (product) => {
    if (product.variantId && product._id) {
      return product;
    }

    const lookupKey = product.slug || product._id;
    const res = await axios.get(`/products/${lookupKey}`);
    const detail = res.data;
    const variant = detail.variants?.[0];

    if (!variant) {
      throw new Error('Product has no purchasable variant.');
    }

    return {
      ...detail,
      _id: detail.id,
      variantId: variant.id,
      sku: variant.sku,
      price: variant.price,
      currency: variant.currency,
      countInStock: variant.availableQuantity
    };
  };

  const addToCart = async (product, qty = 1, options = {}) => {
    if (!isAuthenticated) {
      const message = 'Please login to add items to your cart.';

      if (!options.silent) {
        alert(message);
      }

      throw new Error(message);
    }

    try {
      const activeCart = await getOrCreateCart();
      const cartProduct = await resolveProductForCart(product);
      const res = await axios.post(`/carts/${activeCart.id}/items`, {
        productId: cartProduct._id,
        variantId: cartProduct.variantId,
        quantity: qty,
        unitPrice: String(cartProduct.price),
        currency: cartProduct.currency || 'USD'
      });

      const mutatedCart = res.data.cart ?? res.data;
      return await refreshCartById(mutatedCart.id);
    } catch (err) {
      console.error('Add to cart error:', err.response?.data || err.message);
      if (!options.silent) {
        alert(err.response?.data?.error?.message || err.message || 'Add to cart failed');
      }
      throw err;
    }
  };

  const removeFromCart = async (variantId) => {
    try {
      const activeCartId = cartId || localStorage.getItem(cartStorageKey);

      if (!activeCartId) {
        return;
      }

      const res = await axios.delete(`/carts/${activeCartId}/items/${variantId}`);
      const mutatedCart = res.data.cart ?? res.data;
      return await refreshCartById(mutatedCart.id);
    } catch (err) {
      console.error('Remove error:', err.response?.data || err.message);
    }
  };

  const updateQty = async (variantId, qty) => {
    try {
      const activeCartId = cartId || localStorage.getItem(cartStorageKey);
      const currentItem = cart.find((item) => item.variantId === variantId);

      if (!activeCartId || !currentItem) {
        return;
      }

      const res = await axios.put(`/carts/${activeCartId}/items`, {
        productId: currentItem.productId,
        variantId,
        quantity: qty,
        unitPrice: String(currentItem.price),
        currency: currentItem.currency || 'USD'
      });

      const mutatedCart = res.data.cart ?? res.data;
      return await refreshCartById(mutatedCart.id);
    } catch (err) {
      console.error('Update qty error:', err.response?.data || err.message);
    }
  };

  const clearCart = async () => {
    for (const item of cart) {
      await removeFromCart(item.variantId);
    }
  };

  const resetCart = () => {
    setCart([]);
    setCartId(null);
    localStorage.removeItem(cartStorageKey);
  };

  useEffect(() => {
    if (isHydrating) {
      return;
    }

    if (!isAuthenticated) {
      setCart([]);
      setCartId(null);
      localStorage.removeItem(cartStorageKey);
      return;
    }

    fetchCart();
  }, [isAuthenticated, isHydrating]);

  return (
    <CartContext.Provider
      value={{ cart, cartId, addToCart, removeFromCart, updateQty, clearCart, resetCart, createFreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
