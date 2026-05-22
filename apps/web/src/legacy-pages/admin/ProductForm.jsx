import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function ProductForm({ isNew }) {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    countInStock: '',
    image: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const buildProductPayload = () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price).toFixed(2),
      category: form.category.trim(),
      countInStock: Number(form.countInStock)
    };

    if (form.image.trim().length > 0) {
      payload.image = form.image.trim();
    }

    return payload;
  };

  useEffect(() => {
    if (!isNew && id) {
      axios.get(`/admin/products/${id}`).then(res => {
        const { name, description, price, category, countInStock, image } = res.data;
        setForm({ name, description, price, category, countInStock, image: image || '' });
      }).catch(err => {
        setError(err.response?.data?.error?.message || 'Unable to load product.');
      });
    }
  }, [isNew, id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const config = {
      headers: { Authorization: `Bearer ${accessToken}` }
    };
    const payload = buildProductPayload();

    try {
      setSaving(true);
      setError('');
      if (isNew) {
        await axios.post('/admin/products', payload, config);
        alert('Product created successfully');
      } else {
        await axios.put(`/admin/products/${id}`, payload, config);
        alert('Product updated successfully');
      }
      navigate('/admin/products');
    } catch (err) {
      const fieldErrors = err.response?.data?.error?.fieldErrors;
      const message = fieldErrors
        ? Object.entries(fieldErrors).map(([field, messages]) => `${field}: ${messages.join(', ')}`).join('\n')
        : err.response?.data?.error?.message || err.response?.data?.message || 'Error saving product';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'Add New Product' : 'Edit Product'}
      </h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 shadow rounded">
        <input
          type="text"
          name="name"
          placeholder="Product Name"
          className="input w-full"
          value={form.name}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          className="input w-full overflow-auto whitespace-nowrap font-mono"
          value={form.description}
          onChange={handleChange}
          required
        />



        <input
          type="number"
          name="price"
          placeholder="Price"
          className="input w-full"
          value={form.price}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="category"
          placeholder="Category"
          className="input w-full"
          value={form.category}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="countInStock"
          placeholder="Stock Count"
          className="input w-full"
          value={form.countInStock}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="image"
          placeholder="Image URL"
          className="input w-full"
          value={form.image}
          onChange={handleChange}
        />

        <button className="btn-primary w-full" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isNew ? 'Create Product' : 'Update Product'}
        </button>
      </form>
    </div>
  );
}
