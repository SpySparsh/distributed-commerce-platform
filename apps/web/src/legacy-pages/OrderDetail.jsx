import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function OrderDetail() {
  const { id } = useParams();
  const { accessToken, user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({}); // productId => { rating, comment }

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`/orders/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setOrder(res.data);
      } catch (err) {
        console.error('Error fetching order:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, accessToken]);

  const handleReviewChange = (productId, field, value) => {
    setReviews(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const submitReview = async (productId) => {
    const { rating, comment } = reviews[productId] || {};
    if (!rating || !comment) return alert('Rating and comment are required');

    try {
      await axios.post(
        `/reviews/${productId}`,
        { rating, comment },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      alert('Review submitted!');
    } catch (err) {
      alert(err.response?.data?.message || 'Review failed');
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (!order) return <p className="p-6">Order not found.</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Order Details</h1>

      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-semibold">Order ID: {order._id}</h2>
        <p>Date: {new Date(order.createdAt).toLocaleString()}</p>
        <p>Total Price: ₹{order.totalAmount}</p>
        <p>Status: {order.isDelivered ? '✅ Delivered' : '🕒 Not Delivered'}</p>
      </div>

      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-semibold">Shipping Address</h2>
        <p>{order.shippingInfo.address}</p>
        <p>{order.shippingInfo.city}, {order.shippingInfo.pincode}</p>
      </div>

      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-semibold">Payment Method</h2>
        <p>{order.paymentMethod}</p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Items</h2>
{order.orderItems.map(item => (
  <div
    key={item.product._id || item.product}
    className="border-b py-4 flex items-center gap-4"
  >
    {/* Image */}
    <img
      src={item.product.image || 'https://via.placeholder.com/80'}
      alt={item.product.name}
      className="w-20 h-20 object-cover rounded"
    />

    {/* Info */}
    <div className="flex-1">
      <p className="font-medium text-sm sm:text-base">{item.product.name}</p>
      <p className="text-gray-500 text-sm">Quantity: {item.quantity}</p>
      <p className="text-blue-600 font-semibold text-sm sm:text-base">
        ₹{item.quantity * item.product.price}
      </p>

      {/* Review section */}
      {order.isDelivered && (
        <div className="mt-2 space-x-2">
          <select
            value={reviews[item.product._id]?.rating || ''}
            onChange={(e) => handleReviewChange(item.product._id, 'rating', e.target.value)}
            className="border p-1 rounded text-sm"
          >
            <option value="">Rating</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Comment"
            value={reviews[item.product._id]?.comment || ''}
            onChange={(e) => handleReviewChange(item.product._id, 'comment', e.target.value)}
            className="border p-1 rounded text-sm w-48 sm:w-64"
          />
          <button
            onClick={() => submitReview(item.product._id)}
            className="btn-primary px-2 py-1 text-xs sm:text-sm"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  </div>
))}

      </div>
    </div>
  );
}
