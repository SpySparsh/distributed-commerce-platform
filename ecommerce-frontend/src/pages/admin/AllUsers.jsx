import { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AllUsers() {
  const { accessToken, user } = useAuth(); // ✅ cleaner and works


  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const sortedUsers = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUsers(sortedUsers);
    } catch (err) {
      console.error('Failed to load users:', err.message);
    }
  };

  useEffect(() => {
    if (accessToken) fetchUsers();
  }, [accessToken]);

  const deleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err) {
      alert('Failed to delete user.');
    }
  };

  const promoteUser = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/users/${id}/promote`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      fetchUsers();
    } catch (err) {
      alert('Failed to promote user.');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">All Users</h1>

      {!user ? (
        <p className="text-red-600">User not loaded or not authorized.</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
  <table className="w-full text-xs sm:text-sm whitespace-nowrap">
    <thead className="bg-gray-100 text-left">
      <tr>
        <th className="p-2 sm:p-3">Name</th>
        <th className="p-2 sm:p-3">Email</th>
        <th className="p-2 sm:p-3">Role</th>
        <th className="p-2 sm:p-3">Actions</th>
      </tr>
    </thead>
    <tbody>
      {users.map((u) => (
        <tr key={u._id} className="border-t">
          <td className="p-2 sm:p-3">{u.name}</td>
          <td className="p-2 sm:p-3">{u.email}</td>
          <td className="p-2 sm:p-3 capitalize">{u.role}</td>
          <td className="p-2 sm:p-3 space-y-1 sm:space-x-2">
            {u.role !== 'admin' && (
              <button
                onClick={() => promoteUser(u._id)}
                className="text-green-600 hover:underline block sm:inline"
              >
                Promote
              </button>
            )}
            {user && u._id !== user._id && (
              <button
                onClick={() => deleteUser(u._id)}
                className="text-red-600 hover:underline block sm:inline"
              >
                Delete
              </button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

      )}
    </div>
  );
}
