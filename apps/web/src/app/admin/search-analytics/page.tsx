"use client";

import AdminRoute from "../../../routes/AdminRoute.jsx";
import SearchAnalytics from "../../../legacy-pages/admin/SearchAnalytics.jsx";

export default function AdminSearchAnalyticsPage() {
  return (
    <AdminRoute>
      <SearchAnalytics />
    </AdminRoute>
  );
}
