import { useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from '../api/axios';
import StarRating from '../components/StarRating';
import { useCart } from '../context/CartContext';

export default function SearchResults() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const keyword = params.get('q');

  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();

  useEffect(() => {
    if (!keyword) return;

    const fetch = async () => {
      try {
        const res = await axios.get('/products', {
          params: {
            q: keyword
          }
        });
        setProducts(res.data.products || []); // adjust if needed
      } catch (err) {
        console.error('Search failed:', err.message);
      }
    };

    fetch();
  }, [keyword]);

  return (
    <div className="p-1">
      <h1 className="text-2xl font-bold mb-4">Search Results for "{keyword}"</h1>

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-6">
          {products.filter((product) => product?.slug || product?._id || product?.id).map((product) => {
            const productKey = product.slug || product._id || product.id;

            return (
            <div key={product._id || product.id || productKey} className="bg-white border border-gray-300 rounded-lg shadow-md hover:shadow-2xl transition duration-300">
            <Link to={`/product/${productKey}`} className="block p-4 hover:bg-gray-50 rounded-t-lg">
                <img
                src={product.image || '/assets/product-placeholder.svg'}
                alt={product.name}
                className="w-full h-40 object-cover rounded"
                />
                <h2 className="mt-2 font-semibold text-lg sm:text-base text-sm">{product.name}</h2>
                <p className="text-sm text-gray-500">{product.category}</p>
                <StarRating rating={product.rating} />
                <p className="text-blue-600 font-bold mt-1">₹{product.price}</p>
            </Link>

            <div className="p-4 pt-0">
                <button
                onClick={() => productKey && addToCart(product)}
                className="btn-primary w-full"
                >
                Add to Cart
                </button>
            </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
