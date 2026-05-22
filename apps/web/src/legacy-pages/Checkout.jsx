import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const checkoutIdempotencyStorageKey = (cartId) => `checkout:idempotency:${cartId}`;

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
  return next;
};

const clearCheckoutIdempotencyKey = (cartId) => {
  localStorage.removeItem(checkoutIdempotencyStorageKey(cartId));
};

export default function Checkout() {
  const {
    cart,
    resetCart,
    createFreshCart,
    getOrCreateActiveCart,
    resetCartLifecycle,
    isStaleCartError,
    getStaleCartMessage
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;


  const [shipping, setShipping] = useState({
    address: '',
    city: '',
    pincode: '',
    phone: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('COD');
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

  const createBuyNowCheckoutCart = async () => {
    const { product, quantity } = getBuyNowPayload();
    const cartResponse = await axios.post('/carts');
    const temporaryCart = cartResponse.data.cart ?? cartResponse.data;
    const itemResponse = await axios.post(`/carts/${temporaryCart.id}/items`, {
      productId: product._id,
      variantId: product.variantId,
      quantity,
      unitPrice: String(product.price),
      currency: product.currency || 'USD'
    });

    return itemResponse.data.cart ?? itemResponse.data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    if (!user?.email) return alert('Please login before checkout');

    let activeCart;

    try {
      setLoading(true);
      activeCart = isBuyNow ? await createBuyNowCheckoutCart() : await getOrCreateActiveCart();

      if (!activeCart?.id) return alert('Cart is not ready yet');
      if (!activeCart.items?.length) return alert('No items to order');

      const provider =
        paymentMethod === 'UPI'
          ? 'razorpay'
          : paymentMethod === 'Card'
            ? 'stripe'
            : 'cod';
      const idempotencyKey = getCheckoutIdempotencyKey(activeCart.id);
      const checkoutPayload = {
        cartId: activeCart.id,
        email: user.email,
        shippingAddress: shipping,
        billingAddress: shipping,
        provider,
        idempotencyKey
      };
      let checkout;

      try {
        ({ data: checkout } = await axios.post('/checkout/start', checkoutPayload));
      } catch (err) {
        if (err.response?.status < 500) {
          throw err;
        }

        console.warn('Checkout returned a server error; retrying once with same idempotency key', {
          cartId: activeCart.id,
          idempotencyKey
        });
        ({ data: checkout } = await axios.post('/checkout/start', checkoutPayload));
      }

      if (provider === 'razorpay') {
        if (!checkout.payment?.providerOrderId) {
          throw new Error('Razorpay order was not created. Payment cannot continue.');
        }

        if (!window.Razorpay) {
          throw new Error('Razorpay checkout script is not loaded.');
        }

        const options = {
          key: razorpayKey || checkout.payment.publishableKey,
          amount: Number(checkout.payment.payment.amount) * 100,
          currency: checkout.payment.payment.currency,
          name: 'MyShop',
          description: 'Order Payment',
          order_id: checkout.payment.providerOrderId,
          prefill: {
            email: user.email,
            contact: shipping.phone
          },
          theme: { color: '#3399cc' },
          handler: async (response) => {
            await axios.post('/payments/verify', {
              provider: 'razorpay',
              paymentId: checkout.payment.payment.id,
              providerOrderId: checkout.payment.providerOrderId,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature
            });
            clearCheckoutIdempotencyKey(activeCart.id);
            localStorage.removeItem('buyNowCheckout');

            if (!isBuyNow) {
              resetCart();
              try {
                await createFreshCart('razorpay-payment-returned');
              } catch (freshCartError) {
                console.warn('Payment returned, but a fresh cart could not be created immediately:', freshCartError);
              }
            }

            const orderId = checkout.order?.id || checkout.order?._id || checkout.id || checkout._id;
            if (orderId) {
              navigate(`/order/${orderId}`);
            }
          },
          modal: {
            ondismiss: () => {
              console.warn('Razorpay checkout was dismissed; cart/order state was left unchanged for retry.');
            }
          }
        };

        new window.Razorpay(options).open();
        return;
      }

      const orderId = checkout.order?.id || checkout.order?._id || checkout.id || checkout._id;

      if (!orderId) {
        throw new Error('Checkout succeeded but the response did not include an order id.');
      }

      clearCheckoutIdempotencyKey(activeCart.id);
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
      if (isStaleCartError?.(err)) {
        const message = getStaleCartMessage?.(err) || 'Your previous order was already completed. A new cart has been started.';
        if (activeCart?.id) {
          clearCheckoutIdempotencyKey(activeCart.id);
        }
        await resetCartLifecycle?.('checkout-stale-cart-conflict');
        alert(message);
        return;
      }

      alert(err.response?.data?.error?.message || err.response?.data?.message || 'Order/payment failed');
    } finally {
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
            <option value="COD">Cash on Delivery</option>
            <option value="Card">Credit/Debit Card</option>
            <option value="UPI">UPI</option>
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
