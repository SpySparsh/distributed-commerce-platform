import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../api/axios';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axios.get(`/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        console.error('Error fetching order:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!order) return <p className="p-6">Order not found.</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Order Details</h1>

      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-semibold">Order ID: {order._id}</h2>
        <p>Date: {new Date(order.createdAt).toLocaleString()}</p>
        <p>Total Price: {order.currency} {order.totalAmount}</p>
        <p>Status: {order.status}</p>
      </div>

      <div className="bg-white shadow p-4 rounded mb-6">
        <h2 className="text-lg font-semibold">Shipping Address</h2>
        <p>{order.shippingInfo.address}</p>
        <p>{order.shippingInfo.city}, {order.shippingInfo.pincode}</p>
      </div>

      <div className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Items</h2>
        {order.orderItems.map((item) => {
          const product = item.product || item;
          const productId = product._id || item.productId || item.id;
          const itemName = product.name || item.name || item.sku;
          const itemPrice = Number(product.price || item.unitPrice || 0);

          return (
            <div key={productId} className="border-b py-4 flex items-center gap-4">
              <img
                src={product.image || '/assets/product-placeholder.svg'}
                alt={itemName}
                className="w-20 h-20 object-cover rounded"
              />

              <div className="flex-1">
                <p className="font-medium text-sm sm:text-base">{itemName}</p>
                <p className="text-gray-500 text-sm">Quantity: {item.quantity}</p>
                <p className="text-blue-600 font-semibold text-sm sm:text-base">
                  {item.currency} {(item.quantity * itemPrice).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
