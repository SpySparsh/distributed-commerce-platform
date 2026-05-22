import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const [statsRes, topProductsRes] = await Promise.all([
          axios.get('/admin/dashboard/summary', { headers }),
          axios.get('/admin/top-products', { headers }),
        ]);

        setStats(statsRes.data);
        setTopProducts(topProductsRes.data);
      } catch (err) {
        console.error('Failed to load admin data:', err.message);
      }
    };

    if (accessToken) fetchData();
  }, [accessToken]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/users" className="bg-white shadow p-4 rounded hover:bg-blue-50">
          <h2 className="text-lg font-semibold">Manage Users</h2>
        </Link>

        <Link to="/admin/orders" className="bg-white shadow p-4 rounded hover:bg-blue-50">
          <h2 className="text-lg font-semibold">Manage Orders</h2>
        </Link>

        <Link to="/admin/products" className="bg-white shadow p-4 rounded hover:bg-blue-50">
          <h2 className="text-lg font-semibold">Manage Products</h2>
        </Link>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard title="Total Orders" value={stats.totalOrders} />
          <StatCard title="Revenue" value={`₹${stats.revenue}`} />
          <StatCard title="Users" value={stats.userCount} />
          <StatCard
            title="Delivered"
            value={stats.ordersByStatus?.find(s => s._id === true)?.count || 0}
          />
        </div>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mt-6 mb-2">Top Selling Products</h2>
          <div className="bg-white shadow rounded p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Sold</th>
                  <th className="text-left p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p._id} className="border-t">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.totalSold}</td>
                    <td className="p-2">₹{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded shadow p-4 text-center">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
