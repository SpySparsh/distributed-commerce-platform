import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { addToCart } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const handleBuyNow = () => {
  localStorage.setItem('buyNow', JSON.stringify({ product, qty }));
  navigate('/checkout');
};


  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/products/${id}`);
        setProduct(res.data);
      } catch (err) {
        console.error('Product fetch error:', err.message);
      }
    };

    const fetchReviews = async () => {
      try {
        const res = await axios.get(`/reviews/${id}`);
        setReviews(res.data);
      } catch (err) {
        console.error('Reviews fetch error:', err.message);
      }
    };

    fetchProduct();
    fetchReviews();
  }, [id]);

  if (!product) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Left: Product Image */}
        <div className="bg-white rounded shadow-md">
          <img
            src={product.image || 'https://via.placeholder.com/400'}
            alt={product.name}
            className="w-full h-auto object-cover rounded"
          />
        </div>

        {/* Right: Product Info */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>

          <div className="text-xl font-semibold text-green-600 mb-4">
            ₹{product.price}
          </div>

          <div className="mb-4">
            <span className="font-medium">Category:</span> {product.category}
          </div>

          <div className="mb-4">
            <label className="mr-2 font-medium">Quantity:</label>
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            >
              {Array.from({ length: product.countInStock }, (_, i) => i + 1).map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
            <button
              className="btn-primary mt-2 w-full"
              onClick={handleBuyNow}
              disabled={product.countInStock === 0}
            >
              Buy Now
            </button>


          </div>


          <button
            className="btn-primary w-full"
            disabled={product.countInStock === 0}
            onClick={() => addToCart(product, qty)}
          >
            {product.countInStock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
      <p className="text-gray-700 mb-4 whitespace-pre-wrap font-mono leading-relaxed tracking-wide bg-white/70 p-3 rounded-md border border-gray-200 shadow-sm">
  {product.description}
</p>



      {/* Reviews Section */}
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Customer Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-500">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review, i) => (
              <div key={i} className="border-t pt-4">
                <p className="font-semibold">{review.name}</p>
                <p className="text-yellow-500">Rating: {review.rating} / 5</p>
                <p className="text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
