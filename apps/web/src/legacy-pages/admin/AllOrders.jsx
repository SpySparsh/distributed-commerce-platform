import { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AllOrders() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders/admin/all', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const sortedOrders = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sortedOrders);
    } catch (err) {
      console.error('Failed to fetch orders:', err.message);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const markDelivered = async (orderId) => {
    try {
      await axios.patch(`http://localhost:5000/api/orders/${orderId}/deliver`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchOrders();
    } catch (err) {
      console.error('Error marking as delivered:', err.response?.data || err.message);
      alert('Failed to mark as delivered.');
    }
  };

  const markPaid = async (orderId) => {
    try {
      await axios.patch(`http://localhost:5000/api/orders/${orderId}/pay`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchOrders();
    } catch (err) {
      console.error('Error marking as paid:', err.response?.data || err.message);
      alert('Failed to mark as paid.');
    }
  };

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
              <th className="p-3 text-left">Delivery</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-t">
                <td className="p-2 sm:p-3 max-w-[80px] truncate">{order._id.slice(-6)}</td>
                <td className="p-2 sm:p-3 max-w-[100px] truncate">{order.user?.name || 'Unknown'}</td>
                <td className="p-2 sm:p-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="p-2 sm:p-3 whitespace-nowrap">₹{order.totalAmount}</td>
                <td className="p-2 sm:p-3 text-xs">
                  {order.isPaid ? '✅ Paid' : '❌ Unpaid'}
                  <div className="text-gray-500 text-[10px]">({order.paymentMethod})</div>
                </td>
                <td className="p-2 sm:p-3">{order.isDelivered ? '✅ Delivered' : '🕒 Pending'}</td>
                <td className="p-2 sm:p-3 space-y-1 text-xs">
                  {!order.isPaid && order.paymentMethod === 'COD' && (
                    <button
                      onClick={() => markPaid(order._id)}
                      className="text-green-600 hover:underline block"
                    >
                      Mark Paid
                    </button>
                  )}
                  {!order.isDelivered && (
                    <button
                      onClick={() => markDelivered(order._id)}
                      className="text-blue-600 hover:underline block"
                    >
                      Mark Delivered
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
