// components/HomeCard.jsx
export default function HomeCard({ title, products = [], tag }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-2 gap-4">
        {products.map((product, i) => (
          <div key={i} className="relative">
            <img
              src={product.image}
              alt={product.name}
              className="h-24 w-24 object-contain"
            />
            {product.discount && (
              <span className="absolute top-1 left-1 bg-red-500 text-white text-xs px-2 py-1 rounded">
                {product.discount}
              </span>
            )}
            {product.tag && (
              <span className="absolute top-6 left-1 bg-pink-600 text-white text-xs px-2 py-1 rounded">
                {product.tag}
              </span>
            )}
          </div>
        ))}
      </div>
      <a href="#" className="text-blue-600 text-sm mt-4 hover:underline">
        See all deals
      </a>
    </div>
  );
}
d