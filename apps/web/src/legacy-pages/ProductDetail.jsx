import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const defaultBreakdown = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));

const renderStars = (rating) => {
  const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
};

export default function ProductDetail() {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [productError, setProductError] = useState('');
  const [qty, setQty] = useState(1);
  const [buyingNow, setBuyingNow] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [breakdown, setBreakdown] = useState(defaultBreakdown);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    comment: ''
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewFetchMessage, setReviewFetchMessage] = useState('');
  const [reviewEligibility, setReviewEligibility] = useState({
    checking: false,
    eligible: false,
    message: ''
  });

  const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const reviewOrderId = query.get('reviewOrderId');
  const reviewOrderItemId = query.get('reviewOrderItemId');

  const handleBuyNow = async () => {
    if (!product) {
      return;
    }

    try {
      setBuyingNow(true);
      localStorage.setItem('buyNowCheckout', JSON.stringify({
        product,
        quantity: qty
      }));
      navigate('/checkout?mode=buy-now');
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Unable to start checkout.');
    } finally {
      setBuyingNow(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setProductError('');
        const res = await axios.get(`/products/${id}`);
        setProduct(res.data);
      } catch (err) {
        console.error('Product fetch error:', err.message);
        setProduct(null);
        setProductError(err.response?.status === 404
          ? 'Product not found.'
          : 'Unable to load this product right now.');
      }
    };

    fetchProduct();
  }, [id]);

  const fetchReviews = async (productId) => {
    if (!productId) {
      return;
    }

    try {
      setReviewFetchMessage('');
      const res = await axios.get(`/products/${productId}/reviews`, { skipAuth: true });
      const nextReviews = Array.isArray(res.data.reviews) ? res.data.reviews : [];
      const nextBreakdown = Array.isArray(res.data.breakdown) ? res.data.breakdown : defaultBreakdown;

      setReviews(nextReviews);
      setBreakdown(nextBreakdown);
      setProduct((current) => current === null
        ? current
        : {
            ...current,
            averageRating: res.data.averageRating ?? current.averageRating ?? 0,
            reviewCount: res.data.reviewCount ?? current.reviewCount ?? nextReviews.length
          });
    } catch (err) {
      console.error('Review fetch error:', err.response?.data || err.message);
      setReviews([]);
      setBreakdown(defaultBreakdown);
      setReviewFetchMessage('Reviews are temporarily unavailable.');
    }
  };

  useEffect(() => {
    fetchReviews(product?.id);
  }, [product?.id]);

  useEffect(() => {
    const checkReviewEligibility = async () => {
      if (!product?.id) {
        return;
      }

      if (!user?.email || !reviewOrderId || !reviewOrderItemId) {
        setReviewEligibility({
          checking: false,
          eligible: false,
          message: user?.email
            ? 'Reviews are available after purchasing and receiving this product.'
            : 'Sign in after purchasing and receiving this product to write a verified review.'
        });
        return;
      }

      try {
        setReviewEligibility({ checking: true, eligible: false, message: 'Checking review eligibility...' });
        const res = await axios.get('/reviews/eligibility', {
          params: {
            productId: product.id,
            orderId: reviewOrderId,
            orderItemId: reviewOrderItemId
          }
        });
        setReviewEligibility({
          checking: false,
          eligible: Boolean(res.data.eligible),
          message: res.data.message || (
            res.data.eligible
              ? 'You can review this product.'
              : 'Only verified purchasers can review this product.'
          )
        });
      } catch (err) {
        console.error('Review eligibility error:', err.response?.data || err.message);
        setReviewEligibility({
          checking: false,
          eligible: false,
          message: err.response?.data?.error?.message || 'Only verified purchasers can review this product.'
        });
      }
    };

    checkReviewEligibility();
  }, [product?.id, user?.email, reviewOrderId, reviewOrderItemId]);

  const submitReview = async (event) => {
    event.preventDefault();

    if (!user?.email) {
      setReviewMessage('Please login before writing a review.');
      return;
    }

    if (!reviewOrderId || !reviewOrderItemId) {
      setReviewMessage('Reviews are available after purchasing and receiving this product.');
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewMessage('');
      const res = await axios.post('/reviews', {
        productId: product.id,
        orderId: reviewOrderId,
        orderItemId: reviewOrderItemId,
        rating: reviewForm.rating,
        title: reviewForm.title,
        comment: reviewForm.comment
      });
      const createdReview = res.data.review;
      setReviews((current) => createdReview ? [createdReview, ...current] : current);
      setReviewForm({ rating: 5, title: '', comment: '' });
      setReviewMessage('Review submitted. Thank you for sharing feedback.');
      setReviewEligibility({
        checking: false,
        eligible: false,
        message: 'This delivered order item has already been reviewed.'
      });
      await fetchReviews(product.id);
    } catch (err) {
      setReviewMessage(err.response?.data?.error?.message || 'Unable to submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (productError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Product unavailable</h1>
        <p className="text-gray-600">{productError}</p>
      </div>
    );
  }

  if (!product) return <p className="p-6">Loading...</p>;

  const canSubmitVerifiedReview = reviewEligibility.eligible && !reviewEligibility.checking;
  const reviewEligibilityMessage = reviewEligibility.message || (user?.email
    ? 'Reviews are available after purchasing and receiving this product.'
    : 'Sign in after purchasing and receiving this product to write a verified review.');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded shadow-md">
          <img
            src={product.image || '/assets/product-placeholder.svg'}
            alt={product.name}
            className="w-full h-auto object-cover rounded"
          />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-yellow-500">{renderStars(product.averageRating || product.rating || 0)}</span>
            <span className="font-medium">{Number(product.averageRating || 0).toFixed(1)} / 5</span>
            <span className="text-gray-500">({product.reviewCount || 0} reviews)</span>
          </div>

          <div className="text-xl font-semibold text-green-600 mb-4">
            Rs. {product.price}
          </div>

          <div className="mb-4">
            <span className="font-medium">Category:</span> {product.category}
          </div>

          <div className="mb-4">
            <label className="mr-2 font-medium">Quantity:</label>
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            >
              {Array.from({ length: product.countInStock }, (_, index) => index + 1).map((quantity) => (
                <option key={quantity} value={quantity}>{quantity}</option>
              ))}
            </select>
            <button
              className="btn-primary mt-2 w-full"
              onClick={handleBuyNow}
              disabled={product.countInStock === 0 || buyingNow}
            >
              {buyingNow ? 'Preparing Checkout...' : 'Buy Now'}
            </button>
          </div>

          <button
            className="btn-primary w-full"
            disabled={product.countInStock === 0}
            onClick={() => addToCart(product, qty)}
          >
            {product.countInStock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>

      <p className="text-gray-700 mb-4 whitespace-pre-wrap font-mono leading-relaxed tracking-wide bg-white/70 p-3 rounded-md border border-gray-200 shadow-sm">
        {product.description}
      </p>

      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Customer Reviews</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            {product.reviewCount || 0} reviews - Average {Number(product.averageRating || 0).toFixed(1)} / 5
          </p>
        </div>
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-2 text-sm">
          {(breakdown.length ? breakdown : defaultBreakdown).map((item) => (
            <div key={item.rating} className="rounded border border-gray-200 px-3 py-2">
              <span className="text-yellow-500">{item.rating} star</span>
              <span className="ml-2 text-gray-600">{item.count}</span>
            </div>
          ))}
        </div>

        {reviewFetchMessage && (
          <p className="mb-4 rounded border border-yellow-100 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
            {reviewFetchMessage}
          </p>
        )}

        {!canSubmitVerifiedReview && (
          <p className="mb-4 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {reviewEligibilityMessage}
          </p>
        )}

        {canSubmitVerifiedReview && (
          <form onSubmit={submitReview} className="mb-6 rounded border border-blue-100 bg-blue-50 p-4 space-y-3">
            <h3 className="font-semibold">Write a verified purchase review</h3>
            {reviewMessage && <p className="text-sm text-blue-700">{reviewMessage}</p>}
            <label className="block text-sm font-medium">
              Rating
              <select
                value={reviewForm.rating}
                onChange={(event) => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}
                className="mt-1 block w-full rounded border px-3 py-2"
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} stars</option>
                ))}
              </select>
            </label>
            <input
              value={reviewForm.title}
              onChange={(event) => setReviewForm({ ...reviewForm, title: event.target.value })}
              required
              maxLength={160}
              placeholder="Review title"
              className="w-full rounded border px-3 py-2"
            />
            <textarea
              value={reviewForm.comment}
              onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
              required
              maxLength={2000}
              placeholder="Tell other shoppers about the product"
              className="w-full rounded border px-3 py-2 min-h-28"
            />
            <button type="submit" className="btn-primary" disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="text-gray-500">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{review.reviewerName || 'Verified customer'}</p>
                  {review.verifiedPurchase && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <p className="text-yellow-500">{renderStars(review.rating)}</p>
                <p className="font-medium">{review.title}</p>
                <p className="text-gray-700">{review.comment}</p>
                {review.createdAt && (
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
