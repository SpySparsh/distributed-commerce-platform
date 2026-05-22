import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

export default function Checkout() {
  const { cart, resetCart, createFreshCart, getOrCreateActiveCart } = useCart();
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.email) return alert('Please login before checkout');

    try {
      setLoading(true);
      const activeCart = await getOrCreateActiveCart();

      if (!activeCart?.id) return alert('Cart is not ready yet');
      if (!activeCart.items?.length) return alert('No items to order');

      const provider =
        paymentMethod === 'UPI'
          ? 'razorpay'
          : paymentMethod === 'Card'
            ? 'stripe'
            : 'cod';
      const { data: checkout } = await axios.post('/checkout/start', {
        cartId: activeCart.id,
        email: user.email,
        shippingAddress: shipping,
        billingAddress: shipping,
        provider,
        idempotencyKey: `${activeCart.id}-${Date.now()}`
      });

      if (provider === 'razorpay' && checkout.payment?.providerOrderId && window.Razorpay) {
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
          theme: { color: '#3399cc' }
        };

        new window.Razorpay(options).open();
      }

      const orderId = checkout.order?.id || checkout.order?._id || checkout.id || checkout._id;

      if (!orderId) {
        throw new Error('Checkout succeeded but the response did not include an order id.');
      }

      localStorage.removeItem('buyNow');
      resetCart();
      try {
        await createFreshCart();
      } catch (freshCartError) {
        console.warn('Order placed, but a fresh cart could not be created immediately:', freshCartError);
      }
      navigate(`/order/${orderId}`);

    } catch (err) {
      console.error('Payment/order error:', err);
      alert(err.response?.data?.error?.message || err.response?.data?.message || 'Order/payment failed');
    } finally {
      setLoading(false);
    }
  };



  const handleChange = (e) => {
    setShipping({ ...shipping, [e.target.name]: e.target.value });
  };

  const displayTotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

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
