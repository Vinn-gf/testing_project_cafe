// src/pages/RecommendationPage.jsx

import React, { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import axios from "axios";
import { FaLocationDot, FaStar } from "react-icons/fa6";
import { API_ENDPOINTS } from "../utils/api_endpoints";

const BASE_API_URL = "http://localhost:5000";
const GO_MAPS_KEY = process.env.REACT_APP_GOMAPS_API_KEY;

const RecommendationPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [distances, setDistances] = useState({});
  const [distanceLoading, setdistanceLoading] = useState(true);
  const userId = CookieStorage.get(CookieKeys.UserToken);
  const navigate = useNavigate();

  // 1) get user geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          lat: coords.latitude,
          lng: coords.longitude,
        });
      },
      (err) => {
        setError("Could not get your location");
        console.error(err);
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // 2) fetch recommendations
  useEffect(() => {
    if (!userId) {
      setError("User ID missing—please login");
      setLoading(false);
      return;
    }
    axios
      .get(`${BASE_API_URL}/api/recommend/${userId}`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      })
      .then((resp) => {
        setRecommendations(resp.data.recommendations || []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // 3) once we have both recs and userLocation, compute distances
  useEffect(() => {
    if (!userLocation || recommendations.length === 0) return;

    // for each cafe, fetch its coords then call distance matrix
    const fetchAllDistances = async () => {
      const results = {};
      await Promise.all(
        recommendations.map(async (cafe) => {
          try {
            // 3a) get full cafe detail
            const info = await axios.get(
              `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_DETAIL_CAFE}${cafe.cafe_id}`,
              { headers: { "ngrok-skip-browser-warning": "true" } }
            );
            const { latitude, longitude } = info.data;
            // 3b) distance matrix
            const origins = `${userLocation.lat},${userLocation.lng}`;
            const destinations = `${latitude},${longitude}`;
            const dm = await axios.get(
              `https://maps.gomaps.pro/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${GO_MAPS_KEY}`
            );
            const elem = dm.data.rows?.[0]?.elements?.[0];
            results[cafe.cafe_id] =
              elem && elem.status === "OK" && elem.distance
                ? elem.distance.text
                : "N/A";
          } catch (e) {
            console.warn("Distance fetch error for", cafe.cafe_id, e);
            results[cafe.cafe_id] = "N/A";
          }
        })
      );
      setDistances(results);
      setdistanceLoading(false);
    };

    fetchAllDistances();
  }, [userLocation, recommendations]);

  if (
    loading ||
    !userLocation ||
    (recommendations.length > 0 && distanceLoading)
  ) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#2D3738]">
        <ColorRing
          visible
          height="80"
          width="80"
          ariaLabel="loading"
          colors={["#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2"]}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-[#2D3738] flex items-center justify-center">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#2D3738] min-h-screen overflow-hidden">
      {/* Navbar */}
      <div className="p-4 bg-[#1B2021] font-montserrat">
        <div className="mx-auto w-[90%] flex justify-between items-center text-[#E3DCC2]">
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
            className="md:hidden text-[#E3DCC2]"
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
            <h1
              className="block p-2 text-[#E3DCC2] hover:text-gray-200 cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </h1>
          </div>
        )}
      </div>
      {/* /Navbar */}

      {/* Header */}
      <div className="w-[90%] mx-auto flex justify-between items-center text-[#E3DCC2] mt-6 font-montserrat">
        <h2 className="text-2xl font-semibold">Recommendations for You</h2>
        <button
          onClick={() => navigate("/allcafes")}
          className="bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D]"
        >
          Show All Cafes
        </button>
      </div>

      {/* Cards */}
      <div className="w-[90%] mx-auto mt-4 mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {recommendations.length < 1 ? (
          <p className="text-gray-400 font-montserrat col-span-full">
            No recommendations available.
          </p>
        ) : (
          recommendations.map((cafe) => {
            let imgSrc;
            try {
              imgSrc = require(`../assets/image/card-cafe-${cafe.cafe_id}.jpg`);
            } catch {
              imgSrc = require(`../assets/image/card-cafe.jpg`);
            }
            const distText = distances[cafe.cafe_id] || "…";

            return (
              <div
                key={cafe.cafe_id}
                className="bg-[#1B2021] rounded-md shadow-lg overflow-hidden font-montserrat"
              >
                <Link to={`/detailcafe/${cafe.cafe_id}`}>
                  <div
                    className="relative h-60 bg-cover bg-center"
                    style={{ backgroundImage: `url(${imgSrc})` }}
                  >
                    <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 p-2">
                      <h1 className="text-lg font-bold text-[#E3DCC2]">
                        {cafe.nama_kafe}
                      </h1>
                    </div>
                  </div>
                </Link>
                <div className="p-4 flex flex-col gap-2 text-[#E3DCC2] text-sm">
                  <div className="flex items-center gap-2">
                    <FaLocationDot />
                    <p>{cafe.alamat}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaStar />
                    <p>{cafe.rating} / 5</p>
                  </div>
                  <div className="text-[#e3dcc2] text-[.95rem]">
                    Score : <strong>{cafe.score}</strong>
                  </div>
                  <div className="text-[#e3dcc2] text-[.95rem]">
                    Berjarak <strong>{distText}</strong> dari lokasi Anda
                  </div>
                  {cafe.matched_menu && cafe.matched_menu.length > 0 && (
                    <div className="text-[#e3dcc2] text-[.95rem]">
                      Menu: <strong>{cafe.matched_menu.join(", ")}</strong>
                    </div>
                  )}
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
