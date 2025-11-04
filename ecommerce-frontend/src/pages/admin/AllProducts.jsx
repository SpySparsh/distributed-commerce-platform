import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AllProducts() {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    try {
        const res = await axios.get('/products', {
        headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('Products API Response:', res.data);

        
        const sortedProducts = res.data.products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setProducts(sortedProducts); // ✅ Only set the array
    } catch (err) {
        console.error('Failed to load products:', err.message);
    }
    };


  useEffect(() => {
    fetchProducts();
  }, []);

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/products/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setProducts(products.filter((p) => p._id !== id));
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Products</h1>
        <Link
          to="/admin/products/new"
          className="btn-primary"
        >
          + Add New Product
        </Link>
      </div>

      <div className="bg-white shadow rounded overflow-x-auto">
  <table className="w-full text-xs sm:text-sm whitespace-nowrap">
    <thead className="bg-gray-100 text-left">
      <tr>
        <th className="p-2 sm:p-3">Name</th>
        <th className="p-2 sm:p-3">Category</th>
        <th className="p-2 sm:p-3">Price</th>
        <th className="p-2 sm:p-3">Stock</th>
        <th className="p-2 sm:p-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {products.map(p => (
        <tr key={p._id} className="border-t">
          <td className="p-2 sm:p-3 max-w-[160px] truncate">{p.name}</td>
          <td className="p-2 sm:p-3">{p.category}</td>
          <td className="p-2 sm:p-3">₹{p.price}</td>
          <td className="p-2 sm:p-3">{p.countInStock}</td>
          <td className="p-2 sm:p-3 space-y-1 sm:space-x-2">
            <Link
              to={`/admin/products/${p._id}`}
              className="text-blue-600 hover:underline block sm:inline"
            >
              Edit
            </Link>
            <button
              onClick={() => deleteProduct(p._id)}
              className="text-red-600 hover:underline block sm:inline"
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

    </div>
  );
}
