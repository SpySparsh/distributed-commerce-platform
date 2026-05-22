import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const banners = [
  {
    title: "Prime Day Deals",
    price: "Starting ₹999",
    subtitle: "Perfumes, Watches & more",
    note: "Fast Delivery | Great Offers",
    image: "https://timeavenue.com/wp-content/uploads/2024/03/Breguet-Tradition-Quantieme-Retrograde-7597-7597BRG19WU-3.webp", // Replace with your real image
    image2: "https://scentira.in/cdn/shop/files/chanel_coco_mademoiselle_edp_1_f66e472a-3811-4386-a2b6-eb1130012361.png?v=1750410585", // Extra image 1
    image3: "https://wallpapers.com/images/featured/air-jordan-png-jslfbnp0wgz1qgme.jpg" // Extra image 2
  },
  {
    title: "Click Less. Get More",
    price: "Add to Cart, Add to Life",
    subtitle: "Swipe. Click. Smile.",
    note: "Fast Delivery | Great Offers",
    image: "https://medias.jeanpaulgaultier.com/cdn-cgi/image/width=412,quality=90,format=avif/medias/sys_master/images/h37/h2b/9530544717854/9530544652318/9530544652318.png", // Replace with your real image
    image2: "https://parspng.com/wp-content/uploads/2023/02/shoespng.parspng.com_.png", // Extra image 1
    image3: "https://file.aiquickdraw.com/imgcompressed/img/compressed_10bc64b044f7b628ae9c772d27355c0e.webp" // Extra image 2
  },
  {
    title: "Smell Success.",
    price: "Fragrance That Speaks.",
    subtitle: "Scent of a New Era.",
    note: "",
    image: "https://cdn.shopify.com/s/files/1/0550/1140/9990/files/Passion-de-nomad.png?v=1672221645", // Replace with your real image
    image2: "https://static.vecteezy.com/system/resources/previews/048/558/013/non_2x/a-luxury-perfume-bottle-isolated-against-a-transparent-background-free-png.png", // Extra image 1
    image3: "https://www.pngarts.com/files/4/Luxury-Perfume-PNG-Transparent-Image.png" // Extra image 2
  },
  {
    title: "It’s About Time.",
    price: "Elevate Every Second.",
    subtitle: "Wear What Matters.",
    note: "",
    image: "https://www.pngplay.com/wp-content/uploads/9/Luxury-Watch-PNG-Background.png", // Replace with your real image
    image2: "https://static.vecteezy.com/system/resources/previews/052/935/241/non_2x/luxury-golden-watch-free-png.png", // Extra image 1
    image3: "https://static.wixstatic.com/media/759f30_fe44e7399ac44ae2944df624422211ef~mv2.png/v1/fill/w_388,h_594,al_c,q_85,usm_4.00_1.00_0.00,enc_avif,quality_auto/116508-0013-11.png" // Extra image 2
  },
  {
    title: "Walk the Talk.",
    price: "Dress Like You Mean It",
    subtitle: "From Street to Chic.",
    note: "Threads That Speak.",
    image: "https://wallpapers.com/images/hd/nike-waterproof-shoes-png-nbb-wo8gx8cmbmmsep1h.png", // Replace with your real image
    image2: "https://static.nike.com/a/images/t_default/82b60cf1-a012-4dbe-a99e-90e7d238fc75/custom-nike-air-force-1-low-by-you-shoes.png", // Extra image 1
    image3: "https://dawntown.co.in/cdn/shop/files/nike-sb-dunk-low-x-yuto-matcha-hf8022-300-release-date.webp?v=1749479327" // Extra image 2
  }
  // Add more slides if needed
];

export default function HeroBanner() {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((prev) => (prev + 1) % banners.length);
  const prev = () => setIndex((prev) => (prev - 1 + banners.length) % banners.length);

  useEffect(() => {
    const timer = setInterval(next, 3500); // auto-slide every 5 sec
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-gradient-to-b from-blue-600 via-blue-400 to-[#edf0f5] py-10  sm:px mb">

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white/70 p-2 rounded-full shadow hover:bg-white z-10"
      >
        <ChevronLeft />
      </button>
      <button
        onClick={next}
        className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/70 p-2 rounded-full shadow hover:bg-white z-10"
      >
        <ChevronRight />
      </button>

      {/* Slider Container */}
      <div className="relative w-full h-full overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out h-full"
          style={{
            transform: `translateX(-${index * 100}%)`, // Move one slide width + margin
          }}
        >
          {banners.map(({ title, price, subtitle, note, image, image2, image3 }, i) => (
            <div
  key={i}
  className="w-full h-[400px] flex-shrink-0 flex flex-col justify-between text-white  sm:px-12 "
>
  {/* ✅ Text on Top */}
  <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1 sm:space-y-2">
    <h3 className="uppercase text-base sm:text-sm tracking-wide font-semibold">
      {title}
    </h3>
    <h1 className="text-5xl sm:text-4xl font-bold leading-tight whitespace-pre-line"
>
      {price}
    </h1>
    <p className="text-sm sm:text-xl whitespace-pre-line">{subtitle}</p>
    {note && <p className="text-xs sm:text-sm text-white/90">{note}</p>}
  </div>

  {/* ✅ 3 Images Horizontally Below */}
  <div className="flex justify-center items-end gap-2 sm:gap-6 mt-auto h-[50%]">
    {[image2, image3, image].map((img, idx) => (
      <div key={idx} className="flex-1 flex justify-center">
        <img
          src={img}
          alt={`banner-img-${idx}`}
          className="h-36 sm:h-[250px] object-contain drop-shadow-xl"


        />
      </div>
    ))}
  </div>
</div>

          ))}
        </div>
      </div>
    </div>
  );
}

