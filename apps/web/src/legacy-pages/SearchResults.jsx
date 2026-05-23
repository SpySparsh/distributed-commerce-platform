import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import StarRating from '../components/StarRating';
import { useCart } from '../context/CartContext';
import { resolveFrontendTenantId } from '../lib/tenant-context';

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popular', label: 'Popular' }
];

const ratingOptions = [
  { value: '', label: 'Any rating' },
  { value: '4', label: '4 stars and up' },
  { value: '3', label: '3 stars and up' },
  { value: '2', label: '2 stars and up' }
];

const initialFilters = {
  q: '',
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  rating: '',
  sort: 'relevance',
  inStock: false,
  page: 1
};

const getProductKey = (product) => product?.slug || product?._id || product?.id;

const buildParamsFromSearch = (search) => {
  const params = new URLSearchParams(search);

  return {
    q: params.get('q') || '',
    category: params.get('category') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    rating: params.get('rating') || '',
    sort: params.get('sort') || 'relevance',
    inStock: params.get('inStock') === 'true',
    page: Number(params.get('page') || '1')
  };
};

const toSearchParams = (filters) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || value === false || value === undefined || value === null) {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
};

const highlightMatch = (value, query) => {
  if (!query) {
    return value;
  }

  const index = value.toLowerCase().indexOf(query.toLowerCase());

  if (index < 0) {
    return value;
  }

  return (
    <>
      {value.slice(0, index)}
      <mark className="rounded bg-yellow-100 px-1 text-gray-900">{value.slice(index, index + query.length)}</mark>
      {value.slice(index + query.length)}
    </>
  );
};

const recordSearchClick = async (productId, query) => {
  try {
    const tenantId = await resolveFrontendTenantId();
    await axios.post('/search/click', {
      tenantId,
      productId,
      q: query
    }, {
      skipAuth: true
    });
  } catch {
    // Search click analytics should never block navigation.
  }
};

export default function SearchResults() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [filters, setFilters] = useState(() => ({ ...initialFilters, ...buildParamsFromSearch(search) }));
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      ...buildParamsFromSearch(search)
    }));
  }, [search]);

  const apiParams = useMemo(() => {
    const params = {
      q: filters.q,
      page: filters.page,
      limit: 24,
      sort: filters.sort
    };

    if (filters.category) params.category = filters.category;
    if (filters.brand) params.brand = filters.brand;
    if (filters.minPrice) params.minPrice = filters.minPrice;
    if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    if (filters.rating) params.rating = filters.rating;
    if (filters.inStock) params.inStock = true;

    return params;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await axios.get('/search', {
          params: apiParams,
          skipAuth: true
        });

        if (cancelled) {
          return;
        }

        setProducts((response.data.products || []).filter(getProductKey));
        setSuggestions(response.data.suggestions || []);
        setPagination(response.data.pagination || pagination);
        setTotal(response.data.total || 0);
      } catch (requestError) {
        if (!cancelled) {
          setProducts([]);
          setSuggestions([]);
          setError(requestError.response?.data?.error?.message || 'Search is temporarily unavailable.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [apiParams]);

  const updateFilters = (nextValues) => {
    const nextFilters = {
      ...filters,
      ...nextValues,
      page: nextValues.page || 1
    };
    const queryString = toSearchParams(nextFilters);
    navigate(queryString ? `/search?${queryString}` : '/search');
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    navigate('/search');
  };

  const activeFilterCount = [
    filters.category,
    filters.brand,
    filters.minPrice,
    filters.maxPrice,
    filters.rating,
    filters.inStock
  ].filter(Boolean).length;

  return (
    <div className="bg-gray-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Search</p>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {filters.q ? `Results for "${filters.q}"` : 'Explore products'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {loading ? 'Finding the best matches...' : `${total} product${total === 1 ? '' : 's'} found`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  updateFilters({ q: filters.q });
                }
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search by product, category, brand..."
            />
            <button
              type="button"
              onClick={() => updateFilters({ q: filters.q })}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Filters</h2>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="text-sm font-medium text-blue-600">
                  Clear
                </button>
              )}
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Category</span>
              <input
                value={filters.category}
                onChange={(event) => updateFilters({ category: event.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. shoes"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Brand</span>
              <input
                value={filters.brand}
                onChange={(event) => updateFilters({ brand: event.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Nike"
              />
            </label>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Min price</span>
                <input
                  value={filters.minPrice}
                  onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))}
                  onBlur={() => updateFilters({ minPrice: filters.minPrice })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Max price</span>
                <input
                  value={filters.maxPrice}
                  onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))}
                  onBlur={() => updateFilters({ maxPrice: filters.maxPrice })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Rating</span>
              <select
                value={filters.rating}
                onChange={(event) => updateFilters({ rating: event.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {ratingOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(event) => updateFilters({ inStock: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              In stock only
            </label>
          </aside>

          <main>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 5).map((suggestion) => (
                  <button
                    key={`${suggestion.type}-${suggestion.value}`}
                    type="button"
                    onClick={() => updateFilters({ q: suggestion.value })}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                Sort
                <select
                  value={filters.sort}
                  onChange={(event) => updateFilters({ sort: event.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">No products found</h2>
                <p className="mt-2 text-sm text-gray-500">Try a broader search, remove filters, or explore another category.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Reset search
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => {
                    const productKey = getProductKey(product);

                    return (
                      <div key={product.id || productKey} className="rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                        <Link
                          to={`/product/${productKey}`}
                          className="block p-3"
                          onClick={() => recordSearchClick(product.id, filters.q)}
                        >
                          <img
                            src={product.image || '/assets/product-placeholder.svg'}
                            alt={product.name}
                            className="h-40 w-full rounded-md object-cover"
                          />
                          <h2 className="mt-3 min-h-12 text-sm font-semibold text-gray-900 sm:text-base">
                            {highlightMatch(product.name, filters.q)}
                          </h2>
                          <p className="mt-1 text-xs text-gray-500">{product.category || product.brands?.[0] || 'Product'}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <StarRating rating={Number(product.averageRating || product.rating || 0)} />
                            <span className="text-xs text-gray-500">({product.reviewCount || 0})</span>
                          </div>
                          <p className="mt-2 text-base font-bold text-blue-600">₹{product.price || product.minPrice || '0.00'}</p>
                          {product.totalAvailable > 0 ? (
                            <p className="mt-1 text-xs font-medium text-green-600">In stock</p>
                          ) : (
                            <p className="mt-1 text-xs font-medium text-gray-400">Out of stock</p>
                          )}
                        </Link>

                        <div className="px-3 pb-3">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={!product.totalAvailable}
                            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={!pagination.hasPreviousPage}
                    onClick={() => updateFilters({ page: Math.max((pagination.page || 1) - 1, 1) })}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => updateFilters({ page: (pagination.page || 1) + 1 })}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
