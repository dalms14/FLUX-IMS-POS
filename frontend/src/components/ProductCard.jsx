export default function ProductCard({ name, price }) {
  return (
    <div className="bg-white p-4 rounded-3xl shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center border border-transparent hover:border-[#8B5E3C]">
      <div className="w-full aspect-square bg-gray-100 rounded-2xl mb-3 flex items-center justify-center text-gray-300">
        {/* You can add <img> tag here later */}
        Image
      </div>
      <p className="text-xs font-black text-center text-gray-700 uppercase h-8 overflow-hidden">
        {name}
      </p>
      <p className="text-[#8B5E3C] font-bold mt-1">₱{price.toLocaleString()}</p>
    </div>
  );
}