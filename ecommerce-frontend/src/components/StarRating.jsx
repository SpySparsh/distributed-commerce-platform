export default function StarRating({ rating }) {
  if (!rating || rating <= 0) return null; // ⛔ No stars if no rating

  const filledStars = Math.round(rating);
  const emptyStars = 5 - filledStars;

  return (
    <div className="text-yellow-500 text-sm mb-1">
      {'★'.repeat(filledStars)}
      <span className="text-gray-300">{'★'.repeat(emptyStars)}</span>
    </div>
  );
}
