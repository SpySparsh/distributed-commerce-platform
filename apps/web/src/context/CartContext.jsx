import { createContext, useContext, useEffect, useState } from 'react';
import axios from '../api/axios';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // ✅ Dynamically get token inside functions
  const getToken = () => localStorage.getItem('token');

  const fetchCart = async () => {
    try {
      const res = await axios.get('/cart', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCart(res.data);
    } catch (err) {
      console.error('Fetch cart error:', err.response?.data || err.message);
    }
  };

  const addToCart = async (product, qty = 1) => {
    try {
      console.log('Adding to cart →', {
  url: '/cart',
  token: localStorage.getItem('token'),
  body: { productId: product._id, quantity: qty }
});
      await axios.post(
        '/cart',
        { productId: product._id, quantity: qty },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      fetchCart();
    } catch (err) {
      console.error('Add to cart error:', err.response?.data || err.message);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`/cart/${productId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchCart();
    } catch (err) {
      console.error('Remove error:', err.response?.data || err.message);
    }
  };

  const updateQty = async (productId, qty) => {
    try {
      await axios.put(
        `/cart/${productId}`,
        { quantity: qty },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      fetchCart();
    } catch (err) {
      console.error('Update qty error:', err.response?.data || err.message);
    }
  };

  const clearCart = async () => {
    try {
      const res = await axios.get('/cart', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      for (const item of res.data) {
      if (item?._id) {
        await axios.delete(`/cart/${item._id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      } else {
        console.warn('Invalid cart item:', item);
      }
      }

      fetchCart();
    } catch (err) {
      console.error('Clear cart failed:', err.message);
    }
  };

  // ✅ Fetch cart on component mount
  useEffect(() => {
    fetchCart();
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQty, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
