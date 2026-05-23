"use client";

import type React from "react";
import { useParams } from "next/navigation";
import AdminRoute from "../../../../../routes/AdminRoute.jsx";
import AllReviews from "../../../../../legacy-pages/admin/AllReviews.jsx";

export default function AdminProductReviewsPage() {
  const params = useParams();
  const productId = typeof params["id"] === "string" ? params["id"] : "";
  const ReviewList = AllReviews as React.ComponentType<{ productId: string }>;

  return (
    <AdminRoute>
      <ReviewList productId={productId} />
    </AdminRoute>
  );
}
