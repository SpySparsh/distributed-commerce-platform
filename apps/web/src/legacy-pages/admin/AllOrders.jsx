import { useEffect, useState } from 'react';
import axios from '../../api/axios';

export default function AllOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/admin/orders');
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const transitionOrder = async (orderId, nextStatus) => {
    try {
      await axios.post(`/orders/${orderId}/transitions`, { nextStatus });
      fetchOrders();
    } catch (err) {
      console.error('Order transition failed:', err.response?.data || err.message);
      alert(err.response?.data?.error?.message || 'Failed to update order.');
    }
  };

  if (loading) return <p className="p-6">Loading orders...</p>;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">All Orders</h1>

      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Order ID</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Payment</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-t">
                <td className="p-2 sm:p-3 max-w-[80px] truncate">{order._id.slice(-6)}</td>
                <td className="p-2 sm:p-3 max-w-[100px] truncate">{order.user?.name || 'Unknown'}</td>
                <td className="p-2 sm:p-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="p-2 sm:p-3 whitespace-nowrap">{order.currency} {order.totalAmount}</td>
                <td className="p-2 sm:p-3 text-xs">{order.paymentMethod}</td>
                <td className="p-2 sm:p-3">{order.status}</td>
                <td className="p-2 sm:p-3 space-y-1 text-xs">
                  {order.status === 'pending' && (
                    <button onClick={() => transitionOrder(order._id, 'confirmed')} className="text-green-600 hover:underline block">
                      Confirm
                    </button>
                  )}
                  {order.status === 'confirmed' && (
                    <button onClick={() => transitionOrder(order._id, 'paid')} className="text-green-600 hover:underline block">
                      Mark Paid
                    </button>
                  )}
                  {order.status === 'paid' && (
                    <button onClick={() => transitionOrder(order._id, 'fulfilled')} className="text-blue-600 hover:underline block">
                      Fulfill
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
