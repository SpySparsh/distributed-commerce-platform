import { useEffect, useState } from 'react';
import axios from '../../api/axios';

export default function AllReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/reviews');
      setReviews(res.data.reviews || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const moderateReview = async (reviewId, status) => {
    try {
      await axios.patch(`/reviews/${reviewId}/moderate`, { status });
      fetchReviews();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Unable to moderate review.');
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      await axios.delete(`/reviews/${reviewId}`);
      fetchReviews();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Unable to delete review.');
    }
  };

  if (loading) return <p className="p-6">Loading reviews...</p>;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">All Reviews</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Reviewer</th>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Verified</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id} className="border-t align-top">
                <td className="p-2 sm:p-3">{review.reviewerName}</td>
                <td className="p-2 sm:p-3 text-yellow-500">{'★'.repeat(review.rating)}</td>
                <td className="p-2 sm:p-3">
                  <p className="font-medium">{review.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{review.comment}</p>
                </td>
                <td className="p-2 sm:p-3">{review.verifiedPurchase ? 'Yes' : 'No'}</td>
                <td className="p-2 sm:p-3">{review.status}</td>
                <td className="p-2 sm:p-3 space-y-1 text-xs">
                  {review.status !== 'approved' && (
                    <button onClick={() => moderateReview(review.id, 'approved')} className="block text-green-600 hover:underline">
                      Approve
                    </button>
                  )}
                  {review.status !== 'rejected' && (
                    <button onClick={() => moderateReview(review.id, 'rejected')} className="block text-yellow-600 hover:underline">
                      Reject
                    </button>
                  )}
                  <button onClick={() => deleteReview(review.id)} className="block text-red-600 hover:underline">
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
