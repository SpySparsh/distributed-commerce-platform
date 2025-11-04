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

  useEffect(() => {
    if (!isNew && id) {
      axios.get(`/products/${id}`).then(res => {
        const { name, description, price, category, countInStock, image } = res.data;
        setForm({ name, description, price, category, countInStock, image });
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

    try {
      if (isNew) {
        await axios.post('/products', form, config);
        alert('Product created successfully');
      } else {
        await axios.put(`/products/${id}`, form, config);
        alert('Product updated successfully');
      }
      navigate('/admin/products');
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving product');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'Add New Product' : 'Edit Product'}
      </h1>

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

        <button className="btn-primary w-full" type="submit">
          {isNew ? 'Create Product' : 'Update Product'}
        </button>
      </form>
    </div>
  );
}
