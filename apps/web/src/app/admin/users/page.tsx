"use client";

import AdminRoute from "../../../routes/AdminRoute.jsx";
import AllUsers from "../../../legacy-pages/admin/AllUsers.jsx";

export default function AdminUsersPage() {
  return (
    <AdminRoute>
      <AllUsers />
    </AdminRoute>
  );
}
