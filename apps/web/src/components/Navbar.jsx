import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
      setKeyword('');
    }
  };
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
  <div className="flex justify-between items-center w-full sm:w-auto">
    <Link to="/" className="text-xl font-bold text-blue-600">MyShop</Link>
  </div>

  <form
    onSubmit={handleSearch}
    className="flex w-full sm:w-auto justify-center"
  >
    <input
      type="text"
      placeholder="Search products..."
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      className="border px-3 py-2 rounded-l-md w-full sm:w-64"
    />
    <button
      type="submit"
      className="bg-blue-600 text-white px-4 py-2 rounded-r-md"
    >
      Search
    </button>
  </form>

  <div className="flex flex-wrap justify-center sm:justify-end items-center gap-3 text-sm sm:text-base">
    <Link to="/" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Home</Link>
    <Link to="/cart" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Cart</Link>

    {user ? (
      <>
        <span className="uppercase tracking-wide font-semibold text-gray-700 ">{user.name}</span>
        <Link to="/orders" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">My Orders</Link>

        {user.role === 'admin' && (
          <Link to="/admin" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">
            Admin Dashboard
          </Link>
        )}

        <button onClick={handleLogout} className="uppercase tracking-wide font-semibold text-red-500 font-semibold">Logout</button>
      </>
    ) : (
      <>
        <Link to="/login" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Login</Link>
        <Link to="/register" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Register</Link>
      </>
    )}
  </div>
</nav>

  );
}
