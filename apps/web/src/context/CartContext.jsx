import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from '../api/axios';
import { useAuth } from './AuthContext';

const CartContext = createContext();

const cartStorageKey = 'activeCartId';

const normalizeCart = (responseData) => responseData?.cart ?? responseData;

const getCartStatus = (nextCart) => String(nextCart?.status || '').toLowerCase();

const isActiveCart = (nextCart) => getCartStatus(nextCart) === 'active';

const isCompletedCart = (nextCart) => ['completed', 'converted', 'checked_out'].includes(getCartStatus(nextCart));

const isStaleCartError = (err) => {
  const status = err.response?.status;
  const code = err.response?.data?.error?.code;

  return (
    status === 404 ||
    code === 'CART_NOT_FOUND' ||
    code === 'CHECKOUT_CART_NOT_FOUND' ||
    code === 'CHECKOUT_CART_ALREADY_CHECKED_OUT'
  );
};

const getStaleCartMessage = (err) =>
  err.response?.data?.error?.message || 'Your previous order was already completed. A new cart has been started.';

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
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const checkoutLockedRef = useRef(false);

  const beginCheckoutLock = () => {
    checkoutLockedRef.current = true;
    setCheckoutLocked(true);
    console.info('[cart] checkout lock acquired', { cartId: localStorage.getItem(cartStorageKey) });
  };

  const endCheckoutLock = () => {
    checkoutLockedRef.current = false;
    setCheckoutLocked(false);
    console.info('[cart] checkout lock released', { cartId: localStorage.getItem(cartStorageKey) });
  };

  const isCartMutationLocked = () => checkoutLockedRef.current;

  const persistCart = (nextCart) => {
    setCart(toLegacyCartItems(nextCart));
    setCartId(nextCart.id);
    localStorage.setItem(cartStorageKey, nextCart.id);
  };

  const clearStoredCart = () => {
    setCart([]);
    setCartId(null);
    localStorage.removeItem(cartStorageKey);
  };

  const createFreshCart = async (reason = 'manual') => {
    if (!isAuthenticated) {
      throw new Error('Please login to use your cart.');
    }

    console.info('[cart] creating fresh active cart', { reason, previousCartId: localStorage.getItem(cartStorageKey) });
    clearStoredCart();
    const res = await axios.post('/carts');
    const nextCart = normalizeCart(res.data);
    console.info('[cart] fresh cart created', { cartId: nextCart.id, status: nextCart.status });
    persistCart(nextCart);
    return nextCart;
  };

  const resetCartLifecycle = async (reason = 'stale-cart') => {
    console.warn('[cart] resetting cart lifecycle', {
      reason,
      previousCartId: localStorage.getItem(cartStorageKey)
    });
    return await createFreshCart(reason);
  };

  const getOrCreateActiveCart = async () => {
    if (!isAuthenticated) {
      throw new Error('Please login to use your cart.');
    }

    const storedCartId = localStorage.getItem(cartStorageKey);

    if (storedCartId) {
      try {
        const res = await axios.get(`/carts/${storedCartId}`);
        const existingCart = normalizeCart(res.data);

        if (isActiveCart(existingCart)) {
          console.info('[cart] loaded active stored cart', { cartId: storedCartId, status: existingCart.status });
          persistCart(existingCart);
          return existingCart;
        }

        console.warn('[cart] blocked stale stored cart rehydration', {
          cartId: storedCartId,
          status: existingCart.status,
          completed: isCompletedCart(existingCart)
        });
      } catch (err) {
        console.warn('[cart] replacing missing/unusable stored cart', {
          cartId: storedCartId,
          status: err.response?.status,
          code: err.response?.data?.error?.code
        });
      }
    }

    return await resetCartLifecycle('missing-or-stale-cart');
  };

  const refreshCartById = async (nextCartId) => {
    const res = await axios.get(`/carts/${nextCartId}`);
    const nextCart = normalizeCart(res.data);

    if (!isActiveCart(nextCart)) {
      console.warn('[cart] refreshed cart is not active; replacing', {
        cartId: nextCart.id,
        status: nextCart.status
      });
      return await resetCartLifecycle('refresh-returned-non-active-cart');
    }

    persistCart(nextCart);
    return nextCart;
  };

  const fetchCart = async () => {
    if (isCartMutationLocked()) {
      console.warn('[cart] fetch skipped while checkout is locked');
      return;
    }

    try {
      await getOrCreateActiveCart();
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
    if (isCartMutationLocked()) {
      console.warn('[cart] add-to-cart blocked while checkout is locked');
      return;
    }

    if (!isAuthenticated) {
      const message = 'Please login to add items to your cart.';

      if (!options.silent) {
        alert(message);
      }

      throw new Error(message);
    }

    try {
      const cartProduct = await resolveProductForCart(product);
      const addItemToBackend = async (activeCart) => {
        console.info('[cart] add-to-cart request', {
          cartId: activeCart.id,
          cartStatus: activeCart.status,
          productId: cartProduct._id,
          variantId: cartProduct.variantId,
          quantity: qty
        });

        return await axios.post(`/carts/${activeCart.id}/items`, {
          productId: cartProduct._id,
          variantId: cartProduct.variantId,
          quantity: qty,
          unitPrice: String(cartProduct.price),
          currency: cartProduct.currency || 'USD'
        });
      };

      const activeCart = await getOrCreateActiveCart();
      let res;

      try {
        res = await addItemToBackend(activeCart);
      } catch (err) {
        if (!isStaleCartError(err)) {
          throw err;
        }

        console.warn('[cart] add-to-cart hit stale cart; creating replacement and retrying', {
          cartId: activeCart.id,
          status: activeCart.status,
          code: err.response?.data?.error?.code
        });
        res = await addItemToBackend(await resetCartLifecycle('add-to-cart-stale-cart'));
      }

      const mutatedCart = normalizeCart(res.data);
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
    if (isCartMutationLocked()) {
      console.warn('[cart] remove item blocked while checkout is locked', { variantId });
      return;
    }

    try {
      const activeCart = await getOrCreateActiveCart();

      if (!activeCart.id) {
        return;
      }

      const res = await axios.delete(`/carts/${activeCart.id}/items/${variantId}`);
      const mutatedCart = normalizeCart(res.data);
      return await refreshCartById(mutatedCart.id);
    } catch (err) {
      console.error('Remove error:', err.response?.data || err.message);
    }
  };

  const updateQty = async (variantId, qty) => {
    if (isCartMutationLocked()) {
      console.warn('[cart] quantity update blocked while checkout is locked', { variantId, quantity: qty });
      return;
    }

    try {
      const activeCart = await getOrCreateActiveCart();
      const currentItem = toLegacyCartItems(activeCart).find((item) => item.variantId === variantId);

      if (!activeCart.id || !currentItem) {
        return;
      }

      console.info('[cart] set cart item quantity', {
        cartId: activeCart.id,
        cartStatus: activeCart.status,
        variantId,
        quantity: qty
      });

      const res = await axios.put(`/carts/${activeCart.id}/items`, {
        productId: currentItem.productId,
        variantId,
        quantity: qty,
        unitPrice: String(currentItem.price),
        currency: currentItem.currency || 'USD'
      });

      const mutatedCart = normalizeCart(res.data);
      return await refreshCartById(mutatedCart.id);
    } catch (err) {
      console.error('Update qty error:', err.response?.data || err.message);
    }
  };

  const clearCart = async () => {
    if (isCartMutationLocked()) {
      console.warn('[cart] clear cart blocked while checkout is locked');
      return;
    }

    for (const item of cart) {
      await removeFromCart(item.variantId);
    }
  };

  const resetCart = () => {
    clearStoredCart();
  };

  useEffect(() => {
    if (isHydrating) {
      return;
    }

    if (!isAuthenticated) {
      clearStoredCart();
      return;
    }

    fetchCart();
  }, [isAuthenticated, isHydrating]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartId,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        resetCart,
        createFreshCart,
        getOrCreateActiveCart,
        resetCartLifecycle,
        isStaleCartError,
        getStaleCartMessage,
        checkoutLocked,
        beginCheckoutLock,
        endCheckoutLock
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
