import React, { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { FaStar } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";

const DetailCafe = () => {
  const { id } = useParams();
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState("N/A");
  // const [duration, setDuration] = useState("N/A");
  const [userLocation, setUserLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 5;
  const navigate = useNavigate();

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
    const fetchReviews = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/reviews/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch reviews");
        }
        const data = await response.json();
        setReviews(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    if (cafe) {
      fetchReviews();
    }
  }, [cafe, id]);

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
        const apiKey = process.env.REACT_APP_GOMAPS_API_KE;
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
            // setDuration(data.rows[0].elements[0].duration.text);
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
            <h1
              className="hover:text-gray-200 hover:cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
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

      {/* Detail Section */}
      <div className="container w-[90%] mx-auto my-10 p-4 bg-[#1B2021] rounded-lg shadow-lg font-montserrat">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Gambar Kafe */}
          <div className="w-full md:w-1/2">
            <div
              className="card-img-section h-96 bg-cover bg-center rounded-lg shadow-md transition-transform duration-300 hover:scale-105)"
              style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            ></div>
          </div>
          {/* Informasi Kafe */}
          <div className="w-full md:w-1/2 flex flex-col justify-center text-[#E3DCC2] ">
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
                Harga Makanan : {cafe.harga_makanan}
              </span>
            </p>
            <p className="text-lg mb-2 flex gap-2">
              <span className="font-normal">
                Harga Minuman : {cafe.harga_minuman}
              </span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">Fasilitas : {cafe.fasilitas}</span>
            </p>
            <p className="text-lg mb-2">
              <span className="font-normal">
                Berjarak <strong>{distance}</strong> dari lokasi anda
              </span>
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

      {/* Reviews */}
      <div className="mx-auto w-[90%] my-10 p-6 bg-[#1B2021] text-[#e3dcc2] rounded-lg shadow-lg font-montserrat">
        <h2 className="text-2xl font-bold mb-4">User Reviews</h2>
        <div className="space-y-6">
          {currentReviews.map((review, index) => {
            return (
              <div key={index} className="border rounded-lg">
                <div className="border-b-2 border-[#E3DCC2] w-full">
                  <div className="flex items-center justify-between m-2">
                    <h3 className="text-xl font-bold">{review.nama}</h3>
                  </div>
                </div>
                <p className="m-2">{review.ulasan}</p>
              </div>
            );
          })}
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
      {/* Reviews*/}
    </div>
  );
};

export default DetailCafe;
