import React, { useEffect, useState } from "react";
import axios from "axios";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { FaStar } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { API_ENDPOINTS } from "../utils/api_endpoints";
// import { toast } from "react-toastify";

const DetailCafe = () => {
  const { id } = useParams();
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState("N/A");
  const [userLocation, setUserLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPreferences, setUserPreferences] = useState(null);
  const reviewsPerPage = 5;
  const navigate = useNavigate();

  // --- Ambil Detail Cafe ---
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/${API_ENDPOINTS.GET_DETAIL_CAFE}${id}`
        );
        setCafe(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCafe();
  }, [id]);

  // --- Ambil Reviews ---
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/${API_ENDPOINTS.GET_REVIEWS}${id}`
        );
        setReviews(response.data);
      } catch (err) {
        setError(err.message);
      }
    };
    if (cafe) {
      fetchReviews();
    }
  }, [cafe, id]);

  // --- Ambil Lokasi User ---
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

  // --- Ambil Preferensi User (dari API get_user_by_id) ---
  useEffect(() => {
    const fetchUserPreferences = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID not found. Please login again.");
        return;
      }
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/${API_ENDPOINTS.GET_USER_BY_ID}${userId}`
        );
        // Contoh response: { id_user: 3, username: "Kevin", cafe_telah_dikunjungi: "Meinewelt, Cafe XYZ", ... }
        setUserPreferences(response.data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUserPreferences();
  }, []);

  // --- Fetch Jarak untuk Cafe ---
  useEffect(() => {
    const fetchDistance = async () => {
      if (userLocation && cafe) {
        setDistanceLoading(true);
        const apiKey = process.env.REACT_APP_GOMAPS_API_KE;
        const userLat = userLocation.latitude;
        const userLong = userLocation.longitude;
        const cafeLat = parseFloat(cafe.latitude);
        const cafeLong = parseFloat(cafe.longitude);
        const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;
        try {
          const response = await axios.get(url);
          const data = response.data;
          if (data.rows.length > 0 && data.rows[0].elements.length > 0) {
            setDistance(data.rows[0].elements[0].distance.text);
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

  // Pagination untuk Reviews
  const totalReviews = reviews.length;
  const totalPageReviews = Math.ceil(totalReviews / reviewsPerPage);
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = reviews.slice(indexOfFirstReview, indexOfLastReview);

  const handleNextPage = () => {
    if (currentPage < totalPageReviews) setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  // --- Handle Mark as Visited ---
  const handleMarkVisited = async () => {
    setError("");
    setSuccess("");

    const userId = CookieStorage.get(CookieKeys.UserToken);
    if (!userId) {
      setError("User ID not found. Please login again.");
      return;
    }
    if (!cafe || !cafe.nama_kafe) {
      setError("Cafe data not available.");
      return;
    }
    if (!userPreferences) {
      setError("User preferences not loaded yet.");
      return;
    }

    // Cek apakah café sudah terdaftar di field cafe_telah_dikunjungi
    const alreadyVisited =
      userPreferences.cafe_telah_dikunjungi &&
      userPreferences.cafe_telah_dikunjungi
        .toLowerCase()
        .split(",")
        .map((name) => name.trim())
        .includes(cafe.nama_kafe.toLowerCase());

    if (alreadyVisited) {
      setSuccess("Cafe already marked as visited.");
      return;
    }

    try {
      const response = await axios.post(
        `http://127.0.0.1:5000/${API_ENDPOINTS.VISITED_CAFES}`,
        { user_id: userId, cafe_name: cafe.nama_kafe },
        { headers: { "Content-Type": "application/json" } }
      );
      setSuccess(
        response.data.message || "Cafe marked as visited successfully!"
      );
      // Update state userPreferences agar mencakup cafe yang baru dikunjungi
      setUserPreferences((prev) => ({
        ...prev,
        cafe_telah_dikunjungi: prev.cafe_telah_dikunjungi
          ? `${prev.cafe_telah_dikunjungi}, ${cafe.nama_kafe}`
          : cafe.nama_kafe,
      }));
    } catch (err) {
      setError(
        err.response?.data?.error || "An error occurred. Please try again."
      );
    }
  };

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

  let backgroundImageUrl;
  try {
    backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
  } catch (error) {
    backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
  }

  return (
    <div className="bg-[#1B2021] overflow-hidden">
      {/* Navbar */}
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] text-[#E3DCC2] mx-auto flex justify-between items-center">
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
            <h1
              className="hover:text-gray-200 hover:cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </h1>
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

      {/* Display Pesan Success/Error */}
      {success && <div></div>}
      {error && (
        <div className="w-[90%] mx-auto my-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Detail Section */}
      <div className="container w-[90%] mx-auto my-10 p-4 bg-[#1B2021] rounded-lg shadow-lg font-montserrat">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Gambar Kafe */}
          <div className="w-full md:w-1/2">
            <div
              className="card-img-section h-96 bg-cover bg-center bg-no-repeat rounded-lg shadow-md transition-transform duration-300 hover:scale-105"
              style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            ></div>
          </div>
          {/* Informasi Kafe */}
          <div className="w-full md:w-1/2 flex flex-col justify-center text-[#E3DCC2]">
            <h1 className="text-4xl font-bold mb-4">{cafe.nama_kafe}</h1>
            <p className="text-lg mb-2 flex gap-2">
              <span className="flex items-center relative -top-[0.05rem]">
                <FaStar />
              </span>
              <span>{cafe.rating} / 5</span>
            </p>
            <p className="text-lg mb-2 flex gap-2">
              <span className="flex items-center relative -top-[0.05rem]">
                <FaLocationDot />
              </span>
              <span className="font-normal">{cafe.alamat}</span>
            </p>
            <p className="text-lg mb-2 flex gap-2">
              <span className="font-normal">
                Harga Makanan: {cafe.harga_makanan}
              </span>
            </p>
            <p className="text-lg mb-2 flex gap-2">
              <span className="font-normal">
                Harga Minuman: {cafe.harga_minuman}
              </span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Fasilitas: {cafe.fasilitas}</span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">
                Berjarak <strong>{distance}</strong> dari lokasi anda
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkVisited}
                className={`p-[.75rem] flex items-center justify-center font-bold rounded-lg shadow transition-colors duration-300 ${
                  userPreferences &&
                  userPreferences.cafe_telah_dikunjungi &&
                  userPreferences.cafe_telah_dikunjungi
                    .toLowerCase()
                    .split(",")
                    .map((name) => name.trim())
                    .includes(cafe.nama_kafe.toLowerCase())
                    ? "bg-green-500 text-white cursor-default"
                    : "bg-[#E3DC95] text-[#1B2021] hover:bg-[#A6A867] hover:text-white"
                }`}
                disabled={
                  userPreferences &&
                  userPreferences.cafe_telah_dikunjungi &&
                  userPreferences.cafe_telah_dikunjungi
                    .toLowerCase()
                    .split(",")
                    .map((name) => name.trim())
                    .includes(cafe.nama_kafe.toLowerCase())
                }
              >
                Mark as Visited
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Detail Section */}

      {/* Reviews */}
      <div className="mx-auto w-[90%] my-10 p-6 bg-[#1B2021] text-[#e3dcc2] rounded-lg shadow-lg font-montserrat">
        <h2 className="text-2xl font-bold mb-4">User Reviews</h2>
        <div className="space-y-6">
          {currentReviews.map((review, index) => (
            <div key={index} className="border rounded-lg">
              <div className="border-b-2 border-[#E3DCC2] w-full">
                <div className="flex items-center justify-between m-2">
                  <h3 className="text-xl font-bold">{review.nama}</h3>
                </div>
              </div>
              <p className="m-2">{review.ulasan}</p>
            </div>
          ))}
        </div>
        <div className="w-[90%] mx-auto flex justify-center items-center mt-8 gap-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50 disabled:text-white hover:cursor-pointer"
          >
            Previous
          </button>
          <span className=" text-[#e3dcc2]">
            Page {currentPage} of {totalPageReviews}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPageReviews}
            className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      {/* Reviews */}
    </div>
  );
};

export default DetailCafe;
