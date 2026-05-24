import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

  const formatMoney = (amount, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency
    }).format(Number(amount || 0));

  if (loading) return <p className="p-6">Loading...</p>;
  if (!order) return <p className="p-6">Order not found.</p>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Order Details</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded bg-white p-4 shadow md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Order</p>
          <h2 className="text-lg font-semibold">{order.orderNumber || order._id}</h2>
          <p className="mt-2 text-sm text-gray-600">Placed {new Date(order.createdAt).toLocaleString()}</p>
          <p className="mt-1 text-sm text-gray-600">Status: <span className="font-medium">{order.status}</span></p>
        </div>
        <div className="rounded bg-white p-4 shadow">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
          <p className="text-2xl font-bold">{formatMoney(order.totalAmount, order.currency)}</p>
        </div>
      </div>

      <div className="mb-6 rounded bg-white p-4 shadow">
        <h2 className="mb-2 text-lg font-semibold">Shipping Address</h2>
        <p>{order.shippingInfo.address}</p>
        <p>{order.shippingInfo.city}, {order.shippingInfo.pincode}</p>
      </div>

      <div className="rounded bg-white p-4 shadow">
        <h2 className="mb-4 text-lg font-semibold">Items</h2>
        <div className="divide-y">
          {order.orderItems.map((item) => {
            const product = item.product || item;
            const productId = product._id || item.productId || item.id;
            const itemName = product.name || item.name || 'Product unavailable';
            const itemPrice = Number(product.price || item.unitPrice || 0);

            return (
              <div key={item.id || productId} className="flex items-center gap-4 py-4">
                <img
                  src={item.image || product.image || '/assets/product-placeholder.svg'}
                  alt={itemName}
                  className="h-20 w-20 rounded border border-gray-100 object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold sm:text-base">{itemName}</p>
                  <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  <p className="text-sm font-semibold text-blue-600 sm:text-base">
                    {formatMoney(item.quantity * itemPrice, item.currency || order.currency)}
                  </p>
                </div>

                {(order.isDelivered || order.status === 'fulfilled' || order.status === 'delivered') && (
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
