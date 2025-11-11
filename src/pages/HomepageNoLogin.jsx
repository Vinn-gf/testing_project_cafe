// src/pages/HomepageNoLogin.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { ColorRing } from "react-loader-spinner";
import { Link } from "react-router-dom";
import { API_ENDPOINTS } from "../utils/api_endpoints";
import { FaLocationDot } from "react-icons/fa6";
import { FaStar } from "react-icons/fa";

const parseDistance = (distanceText) => {
  if (!distanceText || distanceText === "N/A") return Infinity;
  const parts = String(distanceText).split(" ");
  const num = parseFloat(parts[0].replace(",", "."));
  return parts[1]?.toLowerCase() === "km" ? num * 1000 : num;
};

// Haversine helper (returns meters)
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const toNum = (v) => (v === null || v === undefined ? NaN : Number(v));
  const a1 = toNum(lat1);
  const o1 = toNum(lon1);
  const a2 = toNum(lat2);
  const o2 = toNum(lon2);
  if (
    !Number.isFinite(a1) ||
    !Number.isFinite(o1) ||
    !Number.isFinite(a2) ||
    !Number.isFinite(o2)
  ) {
    return NaN;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // meters

  const φ1 = toRad(a1);
  const φ2 = toRad(a2);
  const Δφ = toRad(a2 - a1);
  const Δλ = toRad(o2 - o1);

  const sinDphi = Math.sin(Δφ / 2);
  const sinDlambda = Math.sin(Δλ / 2);
  const a =
    sinDphi * sinDphi + Math.cos(φ1) * Math.cos(φ2) * sinDlambda * sinDlambda;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistanceText = (meters) => {
  if (!Number.isFinite(meters) || isNaN(meters)) return "N/A";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const HomepageNoLogin = () => {
  const [cafes, setCafes] = useState([]);
  const [topRatedCafes, setTopRatedCafes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const hero_image = require("../assets/image/hero-bg2.jpg");

  // 1) Load cafes
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ALL_CAFES}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setCafes(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || "Failed to load cafes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) Get user location (for distance only, optional)
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setDistanceLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        setUserLocation({ latitude, longitude });
      },
      (err) => {
        // Tidak fatal — tetap bisa tampilkan top-rated tanpa jarak
        console.warn("Failed to get location:", err?.message || err);
        setUserLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // 3) Build Top-6 by rating (no recommender, no search)
  useEffect(() => {
    if (cafes.length === 0) {
      setTopRatedCafes([]);
      setDistanceLoading(false);
      return;
    }

    try {
      // Tambahkan jarak bila location tersedia
      const withDistance = cafes.map((c) => {
        const cafeLat =
          c.latitude ??
          c.lat ??
          c.latitude_cafe ??
          c.latitude_kafe ??
          c.lintang ??
          null;
        const cafeLon =
          c.longitude ??
          c.lon ??
          c.lng ??
          c.longitude_cafe ??
          c.longitude_kafe ??
          c.bujur ??
          null;

        let distText = "N/A";
        if (
          userLocation &&
          Number.isFinite(Number(cafeLat)) &&
          Number.isFinite(Number(cafeLon))
        ) {
          const meters = haversineMeters(
            userLocation.latitude,
            userLocation.longitude,
            Number(cafeLat),
            Number(cafeLon)
          );
          distText = formatDistanceText(meters);
        }
        return { ...c, distance: distText };
      });

      // Urutkan berdasarkan rating tertinggi, ambil top-6
      const sorted = [...withDistance].sort((a, b) => {
        const ra = Number(a.rating) || 0;
        const rb = Number(b.rating) || 0;
        // desc
        if (rb !== ra) return rb - ra;
        // tie-breaker: lebih dekat lebih dulu (optional)
        return parseDistance(a.distance) - parseDistance(b.distance);
      });

      setTopRatedCafes(sorted.slice(0, 6));
    } catch (e) {
      console.error("Error building top rated cafes:", e);
      setError("Failed to compute top-rated cafes.");
    } finally {
      setDistanceLoading(false);
    }
  }, [cafes, userLocation]);

  if (loading || distanceLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#2D3738]">
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
    return <p className="text-center text-red-500 mt-10">{error}</p>;
  }

  return (
    <div className="bg-[#1B2021] overflow-hidden">
      {/* Navbar */}
      <div className="p-4 bg-[#1B2021] font-montserrat">
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            RecSys.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/register" className="hover:text-gray-200">
              Register
            </Link>
            <Link to="/login" className="hover:text-gray-200">
              Login
            </Link>
            <Link to="/allcafes" className="hover:text-gray-200">
              All Cafes
            </Link>
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
              to="/allcafes"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              All Cafes
            </Link>
            <Link
              to="/login"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Login
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Hero (tanpa search input, hanya CTA Show All Cafes) */}
      <div
        className="relative bg-cover bg-center px-4 sm:px-6 md:px-8 lg:px-16 py-8 h-[65vh]"
        style={{ backgroundImage: `url(${hero_image})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="relative z-10 mx-auto w-[90%] sm:w-[85%] md:w-[75%] lg:w-[60%]">
          <div className="space-y-5">
            <h1 className="font-montserrat text-4xl md:text-[3rem] font-bold text-[#E3DCC2] tracking-wide">
              Recommendation Cafe
            </h1>
            <h1 className="font-montserrat text-4xl md:text-[3rem] font-bold text-[#E3DCC2] tracking-wide">
              System
            </h1>
          </div>

          {/* Hanya tombol Show All Cafes */}
          <Link to="/allcafes">
            <button className="mt-12 w-full sm:w-[10em] p-2 bg-[#1B2021] text-[#E3DCC2] rounded-md hover:bg-[#51513D]">
              Show All Cafes
            </button>
          </Link>
        </div>
      </div>

      {/* Top Rated Recommendations */}
      <div className="p-4">
        <h1 className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] mb-4 text-[1.4rem] font-bold font-montserrat text-[#e3dcc2]">
          Recommended Cafes for You (by Highest Rating)
        </h1>
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topRatedCafes.length < 1 ? (
            <p className="text-gray-400 font-montserrat col-span-full">
              No cafes available.
            </p>
          ) : (
            topRatedCafes.map((c, idx) => {
              const img = (() => {
                try {
                  return require(`../assets/image/card-cafe-${c.nomor}.jpg`);
                } catch {
                  return require(`../assets/image/card-cafe.jpg`);
                }
              })();

              return (
                <div
                  key={idx}
                  className="bg-[#1B2021] rounded-md shadow-lg overflow-hidden font-montserrat"
                >
                  <Link to={`/detailcafe/${c.nomor}`}>
                    <div
                      className="relative h-60 bg-cover bg-center"
                      style={{ backgroundImage: `url(${img})` }}
                    >
                      <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 p-2">
                        <h1 className="text-[1.3rem] font-bold text-[#E3DCC2]">
                          {c.nama_kafe}
                        </h1>
                      </div>
                    </div>
                  </Link>
                  <div className="p-4 flex flex-col gap-2 text-[#E3DCC2] text-[.95rem]">
                    <div className="flex items-center gap-2">
                      <FaLocationDot />
                      <p>{c.alamat}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaStar />
                      <p>{c.rating}</p>
                    </div>

                    {c.distance && (
                      <p>
                        Berjarak <strong>{c.distance}</strong> dari lokasi Anda
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default HomepageNoLogin;
