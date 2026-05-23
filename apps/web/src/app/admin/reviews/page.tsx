"use client";

import AdminRoute from "../../../routes/AdminRoute.jsx";
import AllReviews from "../../../legacy-pages/admin/AllReviews.jsx";

export default function AdminReviewsPage() {
  return (
    <AdminRoute>
      <AllReviews />
    </AdminRoute>
  );
}
