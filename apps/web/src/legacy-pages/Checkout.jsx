import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const checkoutIdempotencyStorageKey = (key) => `checkout:idempotency:${key}`;

const createCheckoutIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCheckoutIdempotencyKey = (cartId) => {
  const storageKey = checkoutIdempotencyStorageKey(cartId);
  const existing = localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const next = createCheckoutIdempotencyKey();
  localStorage.setItem(storageKey, next);
  return `${cartId}:${next}`;
};

const clearCheckoutIdempotencyKey = (cartId) => {
  localStorage.removeItem(checkoutIdempotencyStorageKey(cartId));
};

const getApiErrorMessage = (err) =>
  err.response?.data?.error?.message ||
  err.response?.data?.message ||
  err.message ||
  'Order/payment failed';

export default function Checkout() {
  const {
    cart,
    resetCart,
    createFreshCart,
    getOrCreateActiveCart,
    resetCartLifecycle,
    isStaleCartError,
    getStaleCartMessage,
    beginCheckoutLock,
    endCheckoutLock
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shipping, setShipping] = useState({
    address: '',
    city: '',
    pincode: '',
    phone: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [isBuyNow, setIsBuyNow] = useState(false);

  useEffect(() => {
    setIsBuyNow(new URLSearchParams(window.location.search).get('mode') === 'buy-now');
  }, []);

  const getBuyNowPayload = () => {
    const stored = localStorage.getItem('buyNowCheckout');

    if (!stored) {
      throw new Error('Buy Now checkout data is missing. Please start again from the product page.');
    }

    const parsed = JSON.parse(stored);

    if (!parsed?.product?.variantId || !parsed?.product?._id || !parsed?.quantity) {
      throw new Error('Buy Now checkout data is invalid. Please start again from the product page.');
    }

    return parsed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    if (!user?.email) return alert('Please login before checkout');

    let activeCart;
    let idempotencyScope;
    let releaseCheckoutLock = false;

    try {
      setLoading(true);
      const buyNowPayload = isBuyNow ? getBuyNowPayload() : undefined;
      activeCart = isBuyNow ? undefined : await getOrCreateActiveCart();

      if (!isBuyNow && !activeCart?.id) return alert('Cart is not ready yet');
      if (!isBuyNow && !activeCart.items?.length) return alert('No items to order');
      if (isBuyNow && buyNowPayload === undefined) return alert('Buy Now checkout is not ready yet');

      beginCheckoutLock?.();
      releaseCheckoutLock = true;

      const provider = paymentMethod === 'stripe' ? 'stripe' : 'cod';
      idempotencyScope = isBuyNow
        ? `buy-now:${buyNowPayload.product.variantId}:${buyNowPayload.quantity}`
        : activeCart.id;
      const idempotencyKey = getCheckoutIdempotencyKey(idempotencyScope);
      const checkoutPayload = isBuyNow
        ? {
            productId: buyNowPayload.product._id,
            variantId: buyNowPayload.product.variantId,
            quantity: buyNowPayload.quantity,
            email: user.email,
            shippingAddress: shipping,
            billingAddress: shipping,
            provider,
            idempotencyKey
          }
        : {
            cartId: activeCart.id,
            email: user.email,
            shippingAddress: shipping,
            billingAddress: shipping,
            provider,
            idempotencyKey
          };
      let checkout;

      try {
        ({ data: checkout } = await axios.post(isBuyNow ? '/checkout/buy-now' : '/checkout/start', checkoutPayload));
      } catch (err) {
        throw err;
      }

      if (provider === 'stripe') {
        const checkoutUrl = checkout.payment?.providerCheckoutUrl;

        if (!checkoutUrl) {
          throw new Error('Stripe checkout session was not created. Payment cannot continue.');
        }

        clearCheckoutIdempotencyKey(idempotencyScope);
        endCheckoutLock?.();
        releaseCheckoutLock = false;
        window.location.assign(checkoutUrl);
        return;
      }

      const orderId = checkout.order?.id || checkout.order?._id || checkout.id || checkout._id;

      if (!orderId) {
        throw new Error('Checkout succeeded but the response did not include an order id.');
      }

      clearCheckoutIdempotencyKey(idempotencyScope);
      localStorage.removeItem('buyNowCheckout');

      if (!isBuyNow) {
        resetCart();
        try {
          await createFreshCart();
        } catch (freshCartError) {
          console.warn('Order placed, but a fresh cart could not be created immediately:', freshCartError);
        }
      }

      navigate(`/order/${orderId}`);

    } catch (err) {
      console.error('Payment/order error:', err);
      if (idempotencyScope && [500, 502, 503].includes(Number(err.response?.status))) {
        clearCheckoutIdempotencyKey(idempotencyScope);
      }

      if (isStaleCartError?.(err)) {
        const message = getStaleCartMessage?.(err) || 'Your previous order was already completed. A new cart has been started.';
        if (idempotencyScope) {
          clearCheckoutIdempotencyKey(idempotencyScope);
        }
        await resetCartLifecycle?.('checkout-stale-cart-conflict');
        alert(message);
        return;
      }
      if (err.response?.status === 409) {
        alert(getApiErrorMessage(err));
        return;
      }

      if (err.response?.status >= 500) {
        alert(getApiErrorMessage(err));
        return;
      }

      alert(getApiErrorMessage(err));
    } finally {
      if (releaseCheckoutLock) {
        endCheckoutLock?.();
      }
      setLoading(false);
    }
  };



  const handleChange = (e) => {
    setShipping({ ...shipping, [e.target.name]: e.target.value });
  };

  const displayTotal = isBuyNow
    ? (() => {
        try {
          const { product, quantity } = getBuyNowPayload();
          return Number(product.price) * Number(quantity);
        } catch {
          return 0;
        }
      })()
    : cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded shadow-md">
        <input
          type="text"
          name="address"
          placeholder="Address"
          required
          value={shipping.address}
          onChange={handleChange}
        />

        <input
          type="text"
          name="city"
          placeholder="City"
          required
          value={shipping.city}
          onChange={handleChange}
        />

        <input
          type="text"
          name="pincode"
          placeholder="Pincode"
          required
          value={shipping.pincode}
          onChange={handleChange}
        />

        <input
          type="text"
          name="phone"
          placeholder="Phone Number"
          required
          value={shipping.phone}
          onChange={handleChange}
        />

        <div>
          <label className="block font-medium mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border px-2 py-1 rounded w-full"
          >
            <option value="cod">Cash on Delivery</option>
            <option value="stripe">UPI / Card / Wallet</option>
          </select>
        </div>

        <div className="font-semibold text-xl mt-4">
          Total: ₹{displayTotal}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}
