import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

export default function Checkout() {
  const { cart, clearCart } = useCart();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;


  const [shipping, setShipping] = useState({
    address: '',
    city: '',
    pincode: '',
    phone: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState(null);

  // Detect Buy Now item from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('buyNow');
    if (stored) {
      try {
        const { product, qty } = JSON.parse(stored);
        setBuyNowItem({ product, qty });
      } catch (err) {
        console.error('Invalid buyNow data:', err);
        localStorage.removeItem('buyNow');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let orderItems = [];
    let totalPrice = 0;

    if (buyNowItem) {
      orderItems = [{ product: buyNowItem.product._id, quantity: buyNowItem.qty }];
      totalPrice = buyNowItem.product.price * buyNowItem.qty;
    } else {
      orderItems = cart.map(item => ({
        product: item._id,
        quantity: item.qty,
      }));
      totalPrice = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    }

    if (!orderItems.length) return alert('No items to order');

    try {
      setLoading(true);

      if (paymentMethod === 'COD') {
        await axios.post(
          '/orders',
          { orderItems, shippingInfo: shipping, paymentMethod, totalPrice },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (buyNowItem) localStorage.removeItem('buyNow');
        else clearCart();
        return navigate('/orders');
      }

      // For Razorpay Payment
      const { data: order } = await axios.post('/payment/order', 
        { amount: totalPrice },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: 'INR',
        name: 'Your Store Name',
        description: 'Order Payment',
        order_id: order.id,
        handler: async function (response) {
          // On success
          await axios.post(
            '/orders',
            {
              orderItems,
              shippingInfo: shipping,
              paymentMethod,
              totalPrice,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature
            },
            {
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          );
          if (buyNowItem) localStorage.removeItem('buyNow');
          else clearCart();
          navigate('/orders');
        },
        prefill: {
          name: 'Customer Name',
          email: 'customer@example.com',
          contact: shipping.phone
        },
        theme: { color: '#3399cc' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error('Payment/order error:', err);
      alert(err.response?.data?.message || 'Order/payment failed');
    } finally {
      setLoading(false);
    }
  };



  const handleChange = (e) => {
    setShipping({ ...shipping, [e.target.name]: e.target.value });
  };

  const displayTotal = buyNowItem
    ? buyNowItem.product.price * buyNowItem.qty
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
