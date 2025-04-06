import React, { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useParams } from "react-router-dom";

const sampleReviews = [
  {
    id: 1,
    userName: "John Doe",
    date: "2025-04-01",
    rating: 4,
    comment: "Tempat yang nyaman dan kopinya enak. Recommended!",
  },
  {
    id: 2,
    userName: "Jane Smith",
    date: "2025-03-28",
    rating: 5,
    comment: "Pelayanan ramah dan suasana cozy, sangat menyenangkan.",
  },
];

const DetailCafe = () => {
  const { id } = useParams();
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState("N/A");
  const [duration, setDuration] = useState("N/A");
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/cafe/${id}`);
        if (!response.ok) {
          throw new Error("Kafe tidak ditemukan");
        }
        const data = await response.json();
        setCafe(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCafe();
  }, [id]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("Error mendapatkan lokasi pengguna:", error)
      );
    } else {
      console.error("Geolokasi tidak didukung oleh browser ini.");
    }
  }, []);

  useEffect(() => {
    const fetchDistance = async () => {
      if (userLocation && cafe) {
        setDistanceLoading(true);
        const apiKey = "AlzaSyD-4uTkREKJUnRgRBfkdifFMYkQ-mVVIsH";
        const userLat = userLocation.latitude;
        const userLong = userLocation.longitude;
        const cafeLat = parseFloat(cafe.latitude);
        const cafeLong = parseFloat(cafe.longitude);

        const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;

        try {
          const response = await fetch(url);
          const data = await response.json();
          if (data.rows.length > 0 && data.rows[0].elements.length > 0) {
            setDistance(data.rows[0].elements[0].distance.text);
            setDuration(data.rows[0].elements[0].duration.text);
          }
        } catch (error) {
          console.error("Error mengambil data jarak:", error);
        } finally {
          setDistanceLoading(false);
        }
      }
    };

    fetchDistance();
  }, [userLocation, cafe]);

  if (loading || distanceLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-gray-100">
        <ColorRing
          visible={true}
          height="80"
          width="80"
          ariaLabel="color-ring-loading"
          wrapperStyle={{}}
          wrapperClass="color-ring-wrapper"
          colors={["#1B2021", "#E3DCC2", "#1B2021", "#E3DCC2", "#1B2021"]}
        />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 mt-10">Error: {error}</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] mx-auto flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            Vinn.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/" className="hover:text-gray-200">
              Home
            </Link>
            <Link to="/about" className="hover:text-gray-200">
              Profile
            </Link>
          </div>
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="focus:outline-none text-[#E3DCC2]"
            >
              {isOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="md:hidden">
            <Link to="/" className="block p-2 text-[#E3DCC2]">
              Home
            </Link>
            <Link to="/about" className="block p-2 text-[#E3DCC2]">
              Profile
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Detail Section */}
      <div className="container mx-auto my-10 p-4 bg-[#1B2021] rounded-lg shadow-lg font-montserrat">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Gambar Kafe */}
          <div className="w-full md:w-1/2">
            <div className="card-img-section h-96 bg-cover bg-center rounded-lg shadow-md transition-transform duration-300 hover:scale-105 bg-(url-['../assets/image/card-cafe.jpg'])"></div>
          </div>
          {/* Informasi Kafe */}
          <div className="w-full md:w-1/2 flex flex-col justify-center text-[#E3DCC2] ">
            <h1 className="text-4xl font-bold mb-4">{cafe.nama_kafe}</h1>
            <p className="text-lg mb-2">
              <span className="font-normal">Rating Kafe:</span> {cafe.rating}
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Alamat Kafe:</span> {cafe.alamat}
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Harga Makanan:</span>{" "}
              {cafe.harga_makanan}
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Harga Minuman:</span>{" "}
              {cafe.harga_minuman}
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Jarak:</span> {distance}
            </p>
            <p className="text-lg mb-4">
              <span className="font-normal">Durasi:</span> {duration}
            </p>
            <div className="flex items-center gap-2">
              <button className="p-[.75rem] flex items-center justify-center bg-[#E3DC95] text-[#1B2021] font-bold rounded-lg shadow hover:bg-[#A6A867] transition-colors duration-300 focus:bg-[#A6A867]">
                Mark as Visited
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Detail Section */}

      {/* ✅ [TAMBAHAN] - Bagian Ulasan Pengguna */}
      <div className="container mx-auto my-10 p-6 bg-white rounded-lg shadow-lg font-montserrat">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">User Reviews</h2>
        <div className="space-y-6">
          {sampleReviews.map((review) => (
            <div key={review.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-700">
                  {review.userName}
                </h3>
                <span className="text-sm text-gray-500">{review.date}</span>
              </div>
              <div className="flex items-center mt-2">
                {/* Contoh tampilan rating berupa bintang */}
                {Array(review.rating)
                  .fill(0)
                  .map((_, index) => (
                    <svg
                      key={index}
                      className="w-5 h-5 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.175 0l-3.38 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.97a1 1 0 00-.364-1.118L2.05 9.397c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.97z" />
                    </svg>
                  ))}
              </div>
              <p className="mt-2 text-gray-600">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
      {/* ✅ [TAMBAHAN] - Penutup Bagian Ulasan Pengguna */}
    </div>
  );
};

export default DetailCafe;
