import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import StarRating from '../components/StarRating';
import ProductCarousel from '../components/ProductCarousel';
import HeroBanner from "../components/HeroBanner";

export default function Home() {
  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();
  const categories = ['Shoes / Sneakers','Watch','Perfume']; // or whatever categories you use

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get('/products');
        const sorted = res.data.products
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Newest first
        .slice(0, 8); // Only latest 10

        setProducts(sorted);
        // or res.data if it's directly an array
      } catch (err) {
        console.error('Failed to fetch products:', err.message);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="">
      <HeroBanner />
      <h1 className="text-2xl font-bold mb-6">Recently Added Products</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1  sm:gap-6 px-1 md:px-4">
        {products.map((product) => (
          <div key={product._id} className="bg-white border border-gray-300 rounded-lg shadow-md hover:shadow-2xl transition duration-300">
            <Link to={`/product/${product._id}`} className="block p-4 hover:bg-gray-100 rounded-t-lg">
              <img
                src={product.image || 'https://via.placeholder.com/150'}
                alt={product.name}
                className="w-full h-40 object-cover rounded"
              />
              <h2 className="mt-2 font-semibold text-lg sm:text-base text-sm">
                {product.name.length > 88 ? `${product.name.slice(0, 90)}...` : product.name}
              </h2>
              <p className="text-sm text-gray-500">{product.category}</p>
              <StarRating rating={product.rating} />
              <p className="text-blue-600 font-bold mt-1">₹{product.price}</p>
            </Link>

            <div className="p-4 pt-0">
              <button
                onClick={() => addToCart(product)}
                className="btn-primary w-full"
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-6">Shop by Category</h1>

      {categories.map((cat) => (
        <ProductCarousel key={cat} category={cat} />
      ))}
    </div>
  );
}
