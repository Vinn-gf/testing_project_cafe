// src/pages/RecommendationPage.jsx

import React, { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import axios from "axios";
import { FaLocationDot, FaStar } from "react-icons/fa6";

const BASE_API_URL = "http://localhost:5000";

const RecommendationPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userId = CookieStorage.get(CookieKeys.UserToken);
  const navigate = useNavigate();

  useEffect(() => {
    // 1) Pastikan userId ada
    if (!userId) {
      setError("User ID tidak ditemukan. Silakan login dulu.");
      setLoading(false);
      return;
    }

    // 2) Panggil endpoint Flask
    const fetchRecommendations = async () => {
      try {
        setLoading(true);

        const resp = await axios.get(
          `${BASE_API_URL}/api/recommend/${userId}`,
          { headers: { "ngrok-skip-browser-warning": "true" } }
        );
        if (resp.data.recommendations) {
          setRecommendations(resp.data.recommendations);
        } else {
          setRecommendations([]);
        }
      } catch (err) {
        console.error("Fetch recommendation failed:", err);
        setError("Gagal memuat rekomendasi. Periksa server/API Anda.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [userId]);

  // 3) Loading state
  if (loading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#2D3738]">
        <ColorRing
          visible={true}
          height="80"
          width="80"
          ariaLabel="color‐ring"
          colors={["#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2"]}
        />
      </div>
    );
  }

  // 4) Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#2D3738] flex items-center justify-center">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  // 5) Main UI
  return (
    <div className="bg-[#2D3738] min-h-screen overflow-hidden">
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

      {/* Header + Show All Cafes Button */}
      <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto flex flex-col sm:flex-row justify-between items-center text-[#E3DCC2] mt-6 font-montserrat">
        <h2 className="text-2xl font-semibold">Recommendations For You</h2>
        <button
          onClick={() => navigate("/allcafes")}
          className="mt-3 sm:mt-0 bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D] font-medium"
        >
          Show All Cafes
        </button>
      </div>

      {/* Cards for Recommendations */}
      <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto mt-4 mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {recommendations.length === 0 ? (
          <p className="text-gray-400 font-montserrat col-span-full">
            Tidak ada rekomendasi tersedia.
          </p>
        ) : (
          recommendations.map((cafe) => {
            const img = (() => {
              try {
                return require(`../assets/image/card-cafe-${cafe.cafe_id}.jpg`);
              } catch {
                return require(`../assets/image/card-cafe.jpg`);
              }
            })();

            return (
              <div
                key={cafe.cafe_id}
                className="bg-[#1B2021] rounded-md shadow-lg overflow-hidden font-montserrat"
              >
                <Link to={`/detailcafe/${cafe.cafe_id}`}>
                  <div
                    className="relative h-60 bg-cover bg-center"
                    style={{ backgroundImage: `url(${img})` }}
                  >
                    <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 p-2">
                      <h1 className="text-[1.3rem] font-bold text-[#E3DCC2]">
                        {cafe.nama_kafe}
                      </h1>
                    </div>
                  </div>
                </Link>
                <div className="p-4 flex flex-col gap-2 text-[#E3DCC2] text-[.95rem]">
                  <div className="flex items-center gap-2">
                    <FaLocationDot />
                    <p>{cafe.alamat}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaStar />
                    <p>{cafe.rating}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecommendationPage;
