"use client";

import AdminRoute from "../../../routes/AdminRoute.jsx";
import AllOrders from "../../../legacy-pages/admin/AllOrders.jsx";

export default function AdminOrdersPage() {
  return (
    <AdminRoute>
      <AllOrders />
    </AdminRoute>
  );
}
