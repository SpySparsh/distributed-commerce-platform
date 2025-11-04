import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Navbar from './components/Navbar';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import MyOrders from './pages/MyOrders';
import OrderDetail from './pages/OrderDetail';
import AdminDashboard from './pages/admin/AdminDashboard';
import AllUsers from './pages/admin/AllUsers';
import AllOrders from './pages/admin/AllOrders';
import AllProducts from './pages/admin/AllProducts';
import AdminRoute from './routes/AdminRoute';
import ProductForm from './pages/admin/ProductForm';
import SearchResults from './pages/SearchResults';
import Footer from './components/Footer';




function App() {
  return (
    <BrowserRouter>
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/order/:id" element={<OrderDetail />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AllUsers />} />
        <Route path="/admin/orders" element={<AdminRoute><AllOrders /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AllProducts /></AdminRoute>} />
        <Route path="/admin/products/new" element={<AdminRoute><ProductForm isNew={true} /></AdminRoute>} />
        <Route path="/admin/products/:id" element={<AdminRoute><ProductForm /></AdminRoute>} />
        <Route
          path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/admin/users"
          element={<AdminRoute><AllUsers /></AdminRoute>}
        />
        <Route
          path="/admin/products/new"
          element={<AdminRoute><ProductForm isNew={true} /></AdminRoute>}
        />
        <Route
          path="/admin/products/:id"
          element={<AdminRoute><ProductForm isNew={false} /></AdminRoute>}
        />


        {/* More routes later */}
      </Routes>
      </main>
      <Footer />
    </div>
    </BrowserRouter>
  );
}

export default App;
