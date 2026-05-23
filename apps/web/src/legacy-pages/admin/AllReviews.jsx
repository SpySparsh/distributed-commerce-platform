import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';

const statuses = ['', 'pending', 'approved', 'rejected', 'hidden', 'deleted'];
const sorts = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'rating_high', label: 'Rating high' },
  { value: 'rating_low', label: 'Rating low' }
];

const renderStars = (rating) => '★'.repeat(Number(rating) || 0).padEnd(5, '☆');

export default function AllReviews(props = {}) {
  const { productId } = props;
  const [reviews, setReviews] = useState([]);
  const [productSummary, setProductSummary] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    sort: 'newest',
    page: 1
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const endpoint = productId ? `/admin/products/${productId}/reviews` : '/admin/reviews';
  const queryParams = useMemo(() => ({
    page: filters.page,
    limit: pagination.limit,
    sort: filters.sort,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {})
  }), [filters, pagination.limit]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await axios.get(endpoint, { params: queryParams });
      setReviews(res.data.reviews || []);
      setPagination(res.data.pagination || { page: filters.page, limit: 20, total: 0, totalPages: 1 });
      setProductSummary(res.data.product || null);
      setBreakdown(res.data.breakdown || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [endpoint, queryParams]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? value : 1
    }));
  };

  const runAction = async (reviewId, action) => {
    const label = action === 'delete' ? 'delete' : action;

    if (action === 'delete' && !window.confirm('Delete this review? This hides it from public ratings.')) {
      return;
    }

    try {
      setActionLoading(`${reviewId}:${action}`);
      if (action === 'delete') {
        await axios.delete(`/admin/reviews/${reviewId}`);
      } else {
        await axios.patch(`/admin/reviews/${reviewId}/${action}`);
      }
      await fetchReviews();
    } catch (err) {
      alert(err.response?.data?.error?.message || `Unable to ${label} review.`);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{productId ? 'Product Reviews' : 'All Reviews'}</h1>
          {productSummary && (
            <p className="text-sm text-gray-600">
              {productSummary.name} · {productSummary.reviewCount} approved reviews · {Number(productSummary.averageRating || 0).toFixed(1)} / 5
            </p>
          )}
        </div>
      </div>

      {productSummary && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
          {breakdown.map((item) => (
            <div key={item.rating} className="rounded border bg-white px-3 py-2 text-sm">
              <span className="text-yellow-500">{item.rating} star</span>
              <span className="ml-2 text-gray-600">{item.count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded bg-white p-4 shadow sm:grid-cols-4">
        <input
          value={filters.q}
          onChange={(event) => updateFilter('q', event.target.value)}
          placeholder="Search reviewer, product, title..."
          className="rounded border px-3 py-2"
        />
        <select
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
          className="rounded border px-3 py-2"
        >
          {statuses.map((status) => (
            <option key={status || 'all'} value={status}>{status || 'All statuses'}</option>
          ))}
        </select>
        <select
          value={filters.sort}
          onChange={(event) => updateFilter('sort', event.target.value)}
          className="rounded border px-3 py-2"
        >
          {sorts.map((sort) => (
            <option key={sort.value} value={sort.value}>{sort.label}</option>
          ))}
        </select>
        <button onClick={fetchReviews} className="btn-primary">Refresh</button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded overflow-x-auto">
        {loading ? (
          <p className="p-6">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="p-6 text-gray-500">No reviews found.</p>
        ) : (
          <table className="min-w-full text-sm table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Reviewer</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Rating</th>
                <th className="p-3 text-left">Review</th>
                <th className="p-3 text-left">Verified</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-t align-top">
                  <td className="p-2 sm:p-3">{review.reviewerName}</td>
                  <td className="p-2 sm:p-3">
                    {review.product ? (
                      <Link to={`/admin/products/${review.product.id}/reviews`} className="text-blue-600 hover:underline">
                        {review.product.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="p-2 sm:p-3 text-yellow-500">{renderStars(review.rating)}</td>
                  <td className="p-2 sm:p-3 max-w-md">
                    <p className="font-medium">{review.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-3">{review.comment}</p>
                  </td>
                  <td className="p-2 sm:p-3">{review.verifiedPurchase ? 'Yes' : 'No'}</td>
                  <td className="p-2 sm:p-3 capitalize">{review.status}</td>
                  <td className="p-2 sm:p-3">{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="p-2 sm:p-3">
                    <div className="flex flex-col gap-1 text-xs">
                      {review.status !== 'approved' && (
                        <button disabled={actionLoading === `${review.id}:approve`} onClick={() => runAction(review.id, 'approve')} className="text-left text-green-600 hover:underline">
                          Approve
                        </button>
                      )}
                      {review.status !== 'rejected' && (
                        <button disabled={actionLoading === `${review.id}:reject`} onClick={() => runAction(review.id, 'reject')} className="text-left text-yellow-600 hover:underline">
                          Reject
                        </button>
                      )}
                      {review.status !== 'hidden' && (
                        <button disabled={actionLoading === `${review.id}:hide`} onClick={() => runAction(review.id, 'hide')} className="text-left text-gray-600 hover:underline">
                          Hide
                        </button>
                      )}
                      {review.status !== 'deleted' && (
                        <button disabled={actionLoading === `${review.id}:delete`} onClick={() => runAction(review.id, 'delete')} className="text-left text-red-600 hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          disabled={pagination.page <= 1}
          onClick={() => updateFilter('page', Math.max(1, pagination.page - 1))}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} reviews
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => updateFilter('page', pagination.page + 1)}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
