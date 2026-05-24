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

  const formatMoney = (amount, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency
    }).format(Number(amount || 0));

  const isDelivered = (order) => order.status === 'fulfilled' || order.status === 'delivered' || order.isDelivered;

  if (loading) return <p className="p-6">Loading orders...</p>;
  if (!orders.length) return <p className="p-6">You have no orders yet.</p>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>

      <div className="space-y-5">
        {orders.map((order) => (
          <div key={order._id} className="rounded bg-white p-5 shadow">
            <div className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row">
              <div>
                <h2 className="text-sm font-semibold sm:text-lg">
                  Order <span className="text-blue-600">{order.orderNumber || order._id}</span>
                </h2>
                <p className="text-xs text-gray-500 sm:text-sm">
                  Placed {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-semibold">{formatMoney(order.totalAmount, order.currency)}</p>
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
                  {order.status}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(order.orderItems || []).slice(0, 3).map((item) => (
                <div key={item.id || item.orderItemId || item.productId} className="flex items-center gap-3">
                  <img
                    src={item.image || item.product?.image || '/assets/product-placeholder.svg'}
                    alt={item.name}
                    className="h-14 w-14 rounded border border-gray-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name || 'Product unavailable'}</p>
                    <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                  </div>
                  {isDelivered(order) && (
                    item.reviewed ? (
                      <span className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600">Reviewed</span>
                    ) : (
                      <Link
                        to={`/product/${item.productId}?reviewOrderId=${order.id || order._id}&reviewOrderItemId=${item.id}`}
                        className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Write Review
                      </Link>
                    )
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 text-right">
              <Link
                to={`/order/${order._id}`}
                className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
