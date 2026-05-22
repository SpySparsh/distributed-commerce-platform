"use client";

import AdminRoute from "../../../../routes/AdminRoute.jsx";
import ProductForm from "../../../../legacy-pages/admin/ProductForm.jsx";

export default function EditProductPage() {
  return (
    <AdminRoute>
      <ProductForm isNew={false} />
    </AdminRoute>
  );
}
