import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useCart } from '../context/CartContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();

  useEffect(() => {
    axios.get('/products')
      .then((res) =>{
        console.log('Products:', res.data); 
         setProducts(res.data.products || res.data)}) // handle paginated or direct array
      .catch((err) => console.error(err));
  }, []);

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (half ? 1 : 0);

    return (
      <>
        {'★'.repeat(fullStars)}
        {half && '½'}
        {'☆'.repeat(emptyStars)}
      </>
    );
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product._id} className="border rounded-lg p-4 shadow hover:shadow-lg">
            <img
              src={product.image || 'https://via.placeholder.com/150'}
              alt={product.name}
              className="w-full h-40 object-cover rounded"
            />
            <h2 className="mt-2 font-semibold">{product.name}</h2>
            <p className="text-sm text-gray-600">{product.category}</p>

            {/* ⭐ Star Rating */}
            <div className="text-yellow-500 text-sm">
              {renderStars(product.rating || 0)}{' '}
              <span className="text-gray-600">({product.rating?.toFixed(1) || '0.0'})</span>
            </div>

            <p className="text-blue-600 font-bold mt-1">₹{product.price}</p>
            <button onClick={() => addToCart(product)} className="btn-primary mt-2 w-full">
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
