import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-200 px-6 py-10 mt-12">
  <div className="max-w-7xl mx-auto flex flex-wrap justify-between gap-y-8">

    
    {/* Brand */}
    <div>
      <h3 className="text-xl font-bold mb-3 text-white">ShopMaster</h3>
      <p className="text-sm text-gray-400">
        Your one-stop shop for quality products and seamless service.
        <br />
        We deliver satisfaction.
      </p>
    </div>

    {/* Quick Links */}
    <div>
      <h4 className="text-md font-semibold mb-3 text-white">Quick Links</h4>
      <ul className="space-y-1 text-sm">
        <li><Link to="/" className="hover:underline">Home</Link></li>
        <li><Link to="/products" className="hover:underline">Shop</Link></li>
        <li><Link to="/cart" className="hover:underline">Cart</Link></li>
        <li><Link to="/orders" className="hover:underline">My Orders</Link></li>
      </ul>
    </div>

    {/* Support */}
    <div>
      <h4 className="text-md font-semibold mb-3 text-white">Support</h4>
      <ul className="space-y-1 text-sm">
        <li><Link to="/faq" className="hover:underline">FAQs</Link></li>
        <li><Link to="/contact" className="hover:underline">Contact Us</Link></li>
        <li><Link to="/privacy" className="hover:underline">Privacy Policy</Link></li>
        <li><Link to="/terms" className="hover:underline">Terms & Conditions</Link></li>
      </ul>
    </div>

    {/* Follow Us */}
<div className="w-full sm:w-auto">
  <h4 className="flex justify-center text-md font-semibold mb-3 text-white">Follow Us</h4>
  <div className="flex justify-center sm:justify-start gap-4 text-lg">
    <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
      <FaGithub />
    </a>
    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
      <FaLinkedin />
    </a>
    <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
      <FaTwitter />
    </a>
  </div>
</div>


  </div>

  {/* Bottom Text */}
  <div className="border-t border-gray-700 mt-10 pt-4 text-center text-xs text-gray-400">
    &copy; {new Date().getFullYear()} ShopMaster. All rights reserved.
  </div>
</footer>

  );
}
