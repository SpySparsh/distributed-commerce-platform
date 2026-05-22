import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

export default function Cart() {
  const { cart, updateQty, removeFromCart, clearCart } = useCart();

  const total = Array.isArray(cart)
  ? cart.reduce((acc, item) => acc + item.qty * item.price, 0)
  : 0;


  if (!cart.length)
    return <p className="p-6 text-lg">Your cart is empty. <Link to="/">Shop Now</Link></p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Cart</h1>

      <div className="space-y-4">
        {Array.isArray(cart) && cart.map(item => (
  <div key={item._id} className="flex justify-between items-center bg-white p-4 rounded shadow">
    <div>
      <h2 className="text-base sm:text-xl font-semibold">{item.name}</h2>
      <p className="text-sm sm:text-base">Price: ₹{item.price}</p>
    </div>
    <div className="flex items-center space-x-2">
      <select
        value={item.qty}
        onChange={(e) => updateQty(item._id, Number(e.target.value))}
        className="border px-2 py-1 rounded text-sm sm:text-base"
      >
        {[...Array(item.countInStock).keys()].map(x => (
          <option key={x + 1} value={x + 1}>{x + 1}</option>
        ))}
      </select>
      <button
        onClick={() => removeFromCart(item._id)}
        className="text-red-500 hover:text-red-700 text-sm sm:text-base"
      >
        Remove
      </button>
    </div>
  </div>
))}

      </div>

      <div className="mt-6 text-right">
        <p className="text-xl font-bold">Total: ₹{total}</p>
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
