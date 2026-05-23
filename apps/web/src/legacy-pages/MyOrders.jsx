import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { Link } from 'react-router-dom';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('/orders/my-orders');
        setOrders(res.data);
      } catch (err) {
        console.error('Failed to fetch orders:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) return <p className="p-6">Loading orders...</p>;
  if (!orders.length) return <p className="p-6">You have no orders yet.</p>;

  const isDelivered = (order) => order.status === 'fulfilled' || order.status === 'delivered' || order.isDelivered;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      <div className="space-y-4">
        {orders.map(order => (
          <div
            key={order._id}
            className="bg-white shadow p-4 rounded"
          >
            <div className="flex justify-between gap-4">
              <div>
                <h2 className="text-sm sm:text-lg font-semibold">
                  Order ID: <span className="text-blue-600">{order._id}</span>
                </h2>
                <p className="text-xs sm:text-sm">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                <p className="text-xs sm:text-sm">Total: {order.currency} {order.totalAmount}</p>
                <p className="text-xs sm:text-sm">Status: {order.status}</p>
              </div>

              <Link
                to={`/order/${order._id}`}
                className="text-xs sm:text-sm text-blue-600 underline hover:text-blue-800"
              >
                View Details
              </Link>
            </div>

            {isDelivered(order) && (order.orderItems || []).length > 0 && (
              <div className="mt-4 border-t pt-3 space-y-2">
                <p className="text-sm font-semibold">Review delivered products</p>
                {(order.orderItems || []).map((item) => (
                  <div key={item.id || item.orderItemId || item.productId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{item.name || item.sku || item.productId}</span>
                    {item.reviewed ? (
                      <span className="rounded bg-gray-100 px-3 py-1 text-gray-600">Reviewed</span>
                    ) : (
                      <Link
                        to={`/product/${item.productId}?reviewOrderId=${order.id || order._id}&reviewOrderItemId=${item.id}`}
                        className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                      >
                        Write Review
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
