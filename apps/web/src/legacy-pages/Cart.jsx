import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export default function Cart() {
  const { cart, updateQty, removeFromCart } = useCart();

  const total = Array.isArray(cart)
    ? cart.reduce((acc, item) => acc + item.qty * item.price, 0)
    : 0;

  const formatMoney = (amount, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency
    }).format(Number(amount || 0));

  if (!cart.length) {
    return <p className="p-6 text-lg">Your cart is empty. <Link to="/">Shop Now</Link></p>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Your Cart</h1>

      <div className="space-y-4">
        {Array.isArray(cart) && cart.map((item) => (
          <div
            key={item._id}
            className="flex flex-col gap-4 rounded bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <img
                src={item.image || '/assets/product-placeholder.svg'}
                alt={item.name}
                className="h-20 w-20 rounded border border-gray-100 object-cover"
              />
              <div>
                <h2 className="text-base font-semibold sm:text-xl">{item.name}</h2>
                {item.sku && <p className="text-xs text-gray-500">{item.sku}</p>}
                <p className="text-sm sm:text-base">Price: {formatMoney(item.price, item.currency)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <select
                value={item.qty}
                onChange={(e) => updateQty(item._id, Number(e.target.value))}
                className="rounded border px-2 py-1 text-sm sm:text-base"
              >
                {[...Array(Math.min(Math.max(Number(item.countInStock || 1), item.qty, 1), 99)).keys()].map((x) => (
                  <option key={x + 1} value={x + 1}>{x + 1}</option>
                ))}
              </select>
              <button
                onClick={() => removeFromCart(item._id)}
                className="text-sm text-red-500 hover:text-red-700 sm:text-base"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-right">
        <p className="text-xl font-bold">Total: {formatMoney(total, cart[0]?.currency)}</p>
        <Link
          to="/checkout"
          className="btn-primary mt-4 inline-block"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
