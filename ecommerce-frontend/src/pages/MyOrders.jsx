import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function MyOrders() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/orders/my-orders', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        setOrders(res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (err) {
        console.error('Failed to fetch orders:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [accessToken]);

  if (loading) return <p className="p-6">Loading orders...</p>;
  if (!orders.length) return <p className="p-6">You have no orders yet.</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      <div className="space-y-4">
        {orders.map(order => (
          <div
            key={order._id}
            className="bg-white shadow p-4 rounded flex justify-between items-center"
          >
            <div>
            <h2 className="text-sm sm:text-lg font-semibold">
              Order ID: <span className="text-blue-600">{order._id}</span>
            </h2>
            <p className="text-xs sm:text-sm">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
            <p className="text-xs sm:text-sm">Total: ₹{order.totalAmount}</p>
            <p className="text-xs sm:text-sm">Status: {order.isDelivered ? '✅ Delivered' : '🕒 Pending'}</p>
          </div>

          <Link
            to={`/order/${order._id}`}
            className="text-xs sm:text-sm text-blue-600 underline hover:text-blue-800"
          >
            View Details
          </Link>

          </div>
        ))}
      </div>
    </div>
  );
}
