import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AllProducts() {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/admin/products', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const sortedProducts = [...(res.data.products || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setProducts(sortedProducts);
      setError('');
    } catch (err) {
      console.error('Failed to load products:', err.message);
      setError(err.response?.data?.error?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchProducts();
  }, [accessToken]);

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`/admin/products/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setProducts(products.filter((p) => p._id !== id));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete product');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Products</h1>
        <Link to="/admin/products/new" className="btn-primary">
          + Add New Product
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading products...</p>
        ) : (
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
              {products.map((p) => (
                <tr key={p._id} className="border-t">
                  <td className="p-2 sm:p-3 max-w-[160px] truncate">{p.name}</td>
                  <td className="p-2 sm:p-3">{p.category}</td>
                  <td className="p-2 sm:p-3">{p.currency || 'USD'} {p.price}</td>
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
        )}
      </div>
    </div>
  );
}
