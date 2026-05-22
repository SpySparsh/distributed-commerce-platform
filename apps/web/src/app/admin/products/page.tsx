"use client";

import AdminRoute from "../../../routes/AdminRoute.jsx";
import AllProducts from "../../../legacy-pages/admin/AllProducts.jsx";

export default function AdminProductsPage() {
  return (
    <AdminRoute>
      <AllProducts />
    </AdminRoute>
  );
}
