import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import axios from '../api/axios';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchBoxRef = useRef(null);

  useEffect(() => {
    const query = keyword.trim();

    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await axios.get('/search/autocomplete', {
          params: {
            q: query,
            limit: 8
          },
          skipAuth: true
        });
        setSuggestions(response.data.suggestions || []);
        setShowSuggestions(true);
        setActiveSuggestionIndex(-1);
      } catch (error) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/search?q=${encodeURIComponent(keyword)}`);
      setKeyword('');
      setShowSuggestions(false);
    }
  };

  const navigateToSuggestion = (suggestion) => {
    if (!suggestion) {
      return;
    }

    if (suggestion.type === 'product' && suggestion.slug) {
      navigate(`/product/${suggestion.slug}`);
    } else if (suggestion.type === 'category') {
      navigate(`/search?category=${encodeURIComponent(suggestion.value)}&q=${encodeURIComponent(suggestion.label)}`);
    } else if (suggestion.type === 'brand') {
      navigate(`/search?brand=${encodeURIComponent(suggestion.value)}&q=${encodeURIComponent(suggestion.value)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(suggestion.value)}`);
    }

    setKeyword('');
    setShowSuggestions(false);
  };

  const handleSearchKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((current) => Math.min(current + 1, suggestions.length - 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      navigateToSuggestion(suggestions[activeSuggestionIndex]);
    }

    if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleLogout = () => {
    void logout();
    navigate('/login');
  };

  const displayName = user?.firstName || user?.email;
  const isAdmin = user?.roles?.includes('admin') || user?.permissions?.includes('search:admin');

  return (
    <nav className="bg-white shadow-md px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
  <div className="flex justify-between items-center w-full sm:w-auto">
    <Link to="/" className="text-xl font-bold text-blue-600">MyShop</Link>
  </div>

  <form
    onSubmit={handleSearch}
    className="relative flex w-full sm:w-auto justify-center"
    ref={searchBoxRef}
  >
    <input
      type="text"
      placeholder="Search products..."
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
      onKeyDown={handleSearchKeyDown}
      className="border px-3 py-2 rounded-l-md w-full sm:w-80"
      aria-autocomplete="list"
      aria-expanded={showSuggestions}
      aria-controls="search-suggestions"
    />
    <button
      type="submit"
      className="bg-blue-600 text-white px-4 py-2 rounded-r-md"
    >
      Search
    </button>
    {showSuggestions && suggestions.length > 0 && (
      <div
        id="search-suggestions"
        className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
      >
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.type}-${suggestion.value}-${index}`}
            type="button"
            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-blue-50 ${
              index === activeSuggestionIndex ? 'bg-blue-50' : ''
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              navigateToSuggestion(suggestion);
            }}
          >
            <span className="font-medium text-gray-800">{suggestion.label}</span>
            <span className="text-xs uppercase tracking-wide text-gray-400">{suggestion.type}</span>
          </button>
        ))}
      </div>
    )}
  </form>

  <div className="flex flex-wrap justify-center sm:justify-end items-center gap-3 text-sm sm:text-base">
    <Link to="/" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Home</Link>
    <Link to="/cart" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">Cart</Link>

    {user ? (
      <>
        <span className="uppercase tracking-wide font-semibold text-gray-700 ">{displayName}</span>
        <Link to="/orders" className="uppercase tracking-wide font-semibold text-gray-700 hover:text-blue-600">My Orders</Link>

        {isAdmin && (
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
