import React, { useEffect, useState } from "react";
import axios from "axios";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { FaStar } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";
import { API_ENDPOINTS } from "../utils/api_endpoints";

const DetailCafe = () => {
  const { id } = useParams();
  const [cafe, setCafe] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
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

  // 1) Ambil detail kafe
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_DETAIL_CAFE}${id}`,
          {
            headers: { "ngrok-skip-browser-warning": true },
          }
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

  // 2) Ambil reviews untuk kafe ini
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_REVIEWS}${id}`,
          {
            headers: { "ngrok-skip-browser-warning": true },
          }
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

  // 3) Ambil lokasi user (geolocation)
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      (err) => {
        setError("Failed to get location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // 4) Ambil preferensi user (termasuk cafe_telah_dikunjungi)
  useEffect(() => {
    const fetchUserPreferences = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID not found. Please login again.");
        return;
      }
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_USER_BY_ID}${userId}`
        );
        const data = response.data;
        // parsing café yang sudah dikunjungi (JSON string) → array objek { id_cafe: … }
        let visitedArr = [];
        if (data.cafe_telah_dikunjungi) {
          try {
            visitedArr = JSON.parse(data.cafe_telah_dikunjungi);
            if (!Array.isArray(visitedArr)) {
              visitedArr = [];
            }
          } catch {
            visitedArr = [];
          }
        }
        setUserPreferences({
          ...data,
          cafe_telah_dikunjungi: visitedArr,
        });
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUserPreferences();
  }, []);

  // 5) Hitung jarak ke kafe via Google Distance Matrix
  useEffect(() => {
    const fetchDistance = async () => {
      if (!userLocation || !cafe) return;

      const { latitude: userLat, longitude: userLong } = userLocation;
      const { latitude: cafeLat, longitude: cafeLong } = cafe;

      if (
        isNaN(userLat) ||
        isNaN(userLong) ||
        isNaN(cafeLat) ||
        isNaN(cafeLong)
      ) {
        setError("Invalid coordinates. Distance calculation failed.");
        setDistance("N/A");
        setDistanceLoading(false);
        return;
      }

      setDistanceLoading(true);
      const apiKey = process.env.REACT_APP_GOMAPS_API_KEY;
      const destinations = `${cafeLat},${cafeLong}`;
      const origins = `${userLat},${userLong}`;
      const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${destinations}&origins=${origins}&key=${apiKey}`;

      try {
        const axiosInstance = axios.create({ timeout: 5000 });
        const response = await axiosInstance.get(url);
        const data = response.data;
        if (data.status !== "OK") {
          throw new Error(`API Error: ${data.status}`);
        }
        if (data.rows.length > 0 && data.rows[0].elements.length > 0) {
          setDistance(data.rows[0].elements[0].distance.text);
        } else {
          setDistance("N/A");
        }
      } catch (err) {
        console.error("Error fetching distance:", err.message);
        setError("Failed to calculate distance. Please try again.");
        setDistance("N/A");
      } finally {
        setDistanceLoading(false);
      }
    };
    fetchDistance();
  }, [userLocation, cafe]);

  // 6) Handler search bar
  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  // 7) Pagination untuk reviews
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

  // 8) Hitung array ID kafe yang sudah dikunjungi (hasil parsing di useEffect nomor 4)
  const visitedIds = Array.isArray(userPreferences?.cafe_telah_dikunjungi)
    ? userPreferences.cafe_telah_dikunjungi.map((v) => parseInt(v.id_cafe, 10))
    : [];

  // Ambil ID kafe (titik “nomor” di database kita)
  const cafeId = cafe?.nomor ?? cafe?.id_cafe;
  const alreadyVisited = cafeId
    ? visitedIds.includes(parseInt(cafeId, 10))
    : false;

  // 9) Handle "Mark as Visited"
  const handleMarkVisited = async () => {
    setError("");
    setSuccess("");

    const userId = CookieStorage.get(CookieKeys.UserToken);
    if (!userId) {
      setError("User ID not found. Please login again.");
      return;
    }
    if (!cafeId) {
      setError("Cafe data not available.");
      return;
    }
    // Cek ulang apakah memang sudah dikunjungi
    if (visitedIds.includes(parseInt(cafeId, 10))) {
      setSuccess("Cafe already marked as visited.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_SERVER}/api/visited/${userId}`,
        { id_cafe: parseInt(cafeId, 10) },
        { headers: { "Content-Type": "application/json" } }
      );
      setSuccess(
        response.data.message || "Cafe marked as visited successfully!"
      );
      // Perbarui langsung state local agar tombol berubah menjadi "Already Visited"
      setUserPreferences((prev) => {
        const prevVisited = Array.isArray(prev.cafe_telah_dikunjungi)
          ? prev.cafe_telah_dikunjungi
          : [];
        return {
          ...prev,
          cafe_telah_dikunjungi: [
            ...prevVisited,
            { id_cafe: parseInt(cafeId, 10) },
          ],
        };
      });
    } catch (err) {
      setError(
        err.response?.data?.error || "An error occurred. Please try again."
      );
    }
  };

  // 10) Loading & error splash
  if (loading || distanceLoading || !userLocation) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#2D3738]">
        <ColorRing
          visible={true}
          height="80"
          width="80"
          ariaLabel="color-ring-loading"
          colors={["#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2"]}
        />
      </div>
    );
  }

  // 11) Siapkan background image
  let backgroundImageUrl;
  try {
    backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
  } catch {
    backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
  }

  return (
    <div className="overflow-hidden bg-[#2D3738] min-h-screen">
      {/* Navbar */}
      <div className="p-4 bg-[#1B2021] font-montserrat">
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            Vinn.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/" className="hover:text-gray-200">
              Home
            </Link>
            <Link to="/recommendation" className="hover:text-gray-200">
              Recommendations
            </Link>
            <Link to="/profile" className="hover:text-gray-200">
              Profile
            </Link>
            <h1
              className="hover:text-gray-200 cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </h1>
          </div>
          <button
            className="md:hidden text-[#E3DCC2] focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden mx-auto w-[90%] space-y-2">
            <Link
              to="/"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Home
            </Link>
            <Link
              to="/recommendation"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Recommendations
            </Link>
            <Link
              to="/profile"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Profile
            </Link>
            <Link
              to="#"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Search + Show All Cafes */}
      <div className="px-4 w-[90%] mx-auto flex items-center justify-between mt-6">
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 font-montserrat"
        >
          <input
            className="search-input p-2 rounded-md outline-none text-[#E3DCC2] w-52 bg-[#1B2021]"
            placeholder="Enter your cafe..."
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <button
            type="submit"
            className="search-btn text-[#E3DCC2] bg-[#1B2021] py-2 px-4 rounded-md hover:bg-[#51513D]"
          >
            Search
          </button>
        </form>
        <Link to="/allcafes">
          <button className="check-cafe-btn w-36 text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D] font-montserrat">
            Show All Cafes
          </button>
        </Link>
      </div>
      {/* /Search */}

      {/* Feedback Success / Error */}
      {success && (
        <div className="w-[90%] mx-auto my-4 p-4 bg-green-100 text-green-800 rounded font-montserrat">
          {success}
        </div>
      )}
      {error && (
        <div className="w-[90%] mx-auto my-4 p-4 bg-red-100 text-red-700 rounded font-montserrat">
          {error}
        </div>
      )}

      {/* Detail Section */}
      <div className="container w-[90%] mx-auto my-10 p-4 bg-[#1B2021] rounded-lg font-montserrat">
        <div className="flex flex-col md:flex-row gap-8 shadow-xl shadow-[#1B2021]">
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
            <p className="text-lg mb-2">
              <span className="font-normal">
                Harga Makanan: {cafe.harga_makanan}
              </span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">
                Harga Minuman: {cafe.harga_minuman}
              </span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Fasilitas: {cafe.fasilitas}</span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">
                Berjarak <strong>{distance}</strong> dari lokasi Anda
              </span>
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleMarkVisited}
                className={`p-3 flex items-center justify-center font-bold rounded-lg shadow transition-colors duration-300 ${
                  alreadyVisited
                    ? "bg-green-500 text-white cursor-default"
                    : "bg-[#E3DC95] text-[#1B2021] hover:bg-[#A6A867] hover:text-white"
                }`}
                disabled={alreadyVisited}
              >
                {alreadyVisited ? "Already Visited" : "Mark as Visited"}
              </button>
              <Link to={`/menu/${cafe.nomor}`}>
                <button className="bg-[#E3DC95] text-[#1B2021] hover:bg-[#A6A867] hover:text-white p-3 flex items-center justify-center font-bold rounded-lg shadow transition-colors duration-300">
                  Menu
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* /Detail Section */}

      {/* Reviews */}
      <div className="mx-auto w-[90%] my-10 p-6 bg-[#1B2021] text-[#e3dcc2] rounded-lg shadow-xl shadow-[#1B2021] font-montserrat">
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
          <span className="text-[#e3dcc2]">
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
      {/* /Reviews */}
    </div>
  );
};

export default DetailCafe;
