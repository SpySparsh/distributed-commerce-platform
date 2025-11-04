import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductCarousel({ category }) {
  const [products, setProducts] = useState([]);
  const carouselRef = useRef(null);
  const scrollInterval = useRef(null);

  useEffect(() => {
    const fetch = async () => {
      const res = await axios.get(`/products?category=${category}&limit=10`);
      setProducts(res.data.products || []);
    };
    fetch();
  }, [category]);

  // Start auto scroll
  useEffect(() => {
    startAutoScroll();
    return stopAutoScroll; // clean up on unmount
  }, [products]);

  const startAutoScroll = () => {
    scrollInterval.current = setInterval(() => {
      scrollRight(true);
    }, 3000);
  };

  const stopAutoScroll = () => {
    clearInterval(scrollInterval.current);
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = (auto = false) => {
    const container = carouselRef.current;
    if (!container || products.length === 0) return;

    const maxScrollLeft = container.scrollWidth / 2;

    if (container.scrollLeft + container.offsetWidth >= maxScrollLeft) {
      container.scrollTo({ left: 0, behavior: 'auto' }); // reset to start
    } else {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // Clone the products to simulate infinite loop
  const loopedProducts = [...products, ...products];

  return (
  <div className="my-8 px-0 sm:px-4">

    <h2 className="text-xl font-bold mb-4">{category}</h2>

    <div className="relative bg-gradient-to-r from-slate-400 via-gray-100 to-slate-400 rounded-lg shadow p-4"
>
      {/* Arrows */}
      <button
        onClick={scrollLeft}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow z-10 hover:bg-gray-100"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => scrollRight(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow z-10 hover:bg-gray-100"
      >
        <ChevronRight size={20} />
      </button>

      {/* Product List */}
      <div
        ref={carouselRef}
        className="flex overflow-x-hidden space-x-1 sm:space-x-4"
        style={{ scrollBehavior: 'smooth' }}
        onMouseEnter={stopAutoScroll}
        onMouseLeave={startAutoScroll}
      >
        {loopedProducts.map((p, index) => (
          <Link
          to={`/product/${p._id}`}
          key={index}
          className="w-[23%] sm:w-[30%] md:w-[22%] lg:w-[18%] flex-shrink-0 bg-white rounded-lg shadow hover:shadow-md transition p-2"
        >
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-24 sm:h-32 md:h-40 object-cover rounded"
          />
          <p className="mt-1 text-[10px] sm:text-xs font-semibold text-center truncate">
            {p.name.length > 25 ? `${p.name.slice(0, 27)}..` : p.name}
          </p>
          <p className="text-center text-blue-600 text-xs sm:text-sm font-bold">
            ₹{p.price}
          </p>
        </Link>

        ))}
      </div>
    </div>
  </div>
);

}
