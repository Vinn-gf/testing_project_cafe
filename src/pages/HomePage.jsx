import React, { useEffect, useState } from "react";
import axios from "axios";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { API_ENDPOINTS } from "../utils/api_endpoints";
import { FaLocationDot } from "react-icons/fa6";
import { FaStar } from "react-icons/fa";

const parseDistance = (distanceText) => {
  if (!distanceText || distanceText === "N/A") return Infinity;
  const parts = distanceText.split(" ");
  const num = parseFloat(parts[0].replace(",", "."));
  return parts[1]?.toLowerCase() === "km" ? num * 1000 : num;
};

const HomePage = () => {
  const [cafes, setCafes] = useState([]);
  const [recommendedCafes, setRecommendedCafes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();
  const hero_image = require("../assets/image/hero-bg2.jpg");

  // 1) Fetch all cafes
  useEffect(() => {
    const fetchCafes = async () => {
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ALL_CAFES}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setCafes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCafes();
  }, []);

  // 2) Get user GPS or IP
  useEffect(() => {
    const getGPS = () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation)
          return reject(new Error("Geolokasi tidak didukung"));
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          reject,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      });
    const getIP = async () => {
      const { data } = await axios.get("https://ipapi.co/json/");
      return { latitude: data.latitude, longitude: data.longitude };
    };
    (async () => {
      try {
        const gps = await getGPS();
        setUserLocation(gps);
      } catch {
        try {
          const ip = await getIP();
          setUserLocation(ip);
        } catch (e) {
          setError("Gagal mendapatkan lokasi user.");
        }
      }
    })();
  }, []);

  // 3) Fetch user preferences
  useEffect(() => {
    const fetchPrefs = async () => {
      const uid = CookieStorage.get(CookieKeys.UserToken);
      if (!uid) {
        setError("User ID tidak ditemukan. Silakan login kembali.");
        return;
      }
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_USER_BY_ID}${uid}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setUserPreferences(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchPrefs();
  }, []);

  // 4) Compute distances & filter recommendations
  useEffect(() => {
    const loadRecs = async () => {
      if (!userLocation || !userPreferences || cafes.length === 0) return;
      const apiKey = process.env.REACT_APP_GOMAPS_API_KE;
      const { latitude: uLat, longitude: uLong } = userLocation;

      // add distance info
      const withDistance = await Promise.all(
        cafes.map(async (cafe) => {
          try {
            const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?&destinations=${cafe.latitude} , ${cafe.longitude}&origins=${uLat} , ${uLong}&key=${apiKey}`;
            const { data } = await axios.get(url);
            const el = data.rows?.[0]?.elements?.[0] || {};
            return {
              ...cafe,
              distance: el.distance?.text || "N/A",
              duration: el.duration?.text || "N/A",
            };
          } catch {
            return { ...cafe, distance: "N/A", duration: "N/A" };
          }
        })
      );

      const minM = parseFloat(userPreferences.preferensi_jarak_minimal) * 1000;
      const maxM = parseFloat(userPreferences.preferensi_jarak_maksimal) * 1000;
      const mid = (minM + maxM) / 2;
      const facs = userPreferences.preferensi_fasilitas
        .split(",")
        .map((s) => s.trim().toLowerCase());

      // 1) first try all fasilitas & in-range
      let filtered = withDistance.filter((cafe) => {
        const d = parseDistance(cafe.distance);
        const inRange = d >= minM && d <= maxM;
        const hasAll = facs.every((f) =>
          cafe.fasilitas?.toLowerCase().includes(f)
        );
        return inRange && hasAll;
      });

      // 2) if none, fallback to any satu fasilitas, sorted by closeness to mid
      if (filtered.length === 0) {
        const anyFac = withDistance.filter((cafe) =>
          facs.some((f) => cafe.fasilitas?.toLowerCase().includes(f))
        );
        anyFac.sort(
          (a, b) =>
            Math.abs(parseDistance(a.distance) - mid) -
            Math.abs(parseDistance(b.distance) - mid)
        );
        filtered = anyFac;
      }

      setRecommendedCafes(filtered.slice(0, 6));
      setDistanceLoading(false);
    };
    loadRecs();
  }, [userLocation, userPreferences, cafes]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchKeyword.trim()) navigate(`/search/${searchKeyword}`);
  };

  if (loading || distanceLoading || !userLocation) {
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
    return <p className="text-center text-red-500 mt-10">Error: {error}</p>;
  }

  return (
    <div className="bg-[#1B2021] overflow-hidden">
      {/* Navbar */}
      <div className="bg-[#1B2021] p-4 font-montserrat">
        <div className="container mx-auto w-[90%] md:w-[95%] lg:w-[90%] flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            Vinn.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/" className="hover:text-gray-200">
              Home
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
            className="md:hidden focus:outline-none text-[#E3DCC2]"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden w-[90%] mx-auto space-y-2">
            <Link to="/" className="block p-2 text-[#E3DCC2]">
              Home
            </Link>
            <Link to="/profile" className="block p-2 text-[#E3DCC2]">
              Profile
            </Link>
            <Link
              to="#"
              className="block p-2 text-[#E3DCC2]"
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

      {/* Hero */}
      <div
        className="relative bg-cover bg-center px-4 sm:px-6 md:px-8 lg:px-16 py-8 h-[65vh]"
        style={{ backgroundImage: `url(${hero_image})` }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="relative z-10 w-[90%] sm:w-[85%] md:w-[75%] lg:w-[60%] mx-auto">
          <h1 className="font-montserrat text-[#E3DCC2] font-bold text-4xl md:text-[4rem] tracking-wide">
            Welcome.
          </h1>
          <p className="text-[#E3DCC2] font-poppins mt-2">
            find your comfort and happy place.
          </p>
          <form
            onSubmit={handleSearch}
            className="mt-6 mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 font-montserrat"
          >
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="p-2 rounded-md outline-none bg-[#1B2021] text-[#E3DCC2] w-full sm:w-2/3 md:w-[30%]"
              placeholder="Enter your cafe..."
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-md bg-[#1B2021] text-[#E3DCC2] hover:bg-[#51513D] w-full sm:w-auto"
            >
              Search
            </button>
          </form>
          <Link to="/allcafes">
            <button className="mt-12 w-full sm:w-[10em] p-2 bg-[#1B2021] text-[#E3DCC2] rounded-md hover:bg-[#51513D]">
              Show All Cafes
            </button>
          </Link>
        </div>
      </div>

      {/* Recommendation Section */}
      <div className="p-4">
        <h1 className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto text-[#e3dcc2] font-montserrat font-bold text-[1.4rem] mb-4">
          Recommended Cafes Based on Your Preferences
        </h1>
        <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recommendedCafes.map((cafe, idx) => {
            const img = (() => {
              try {
                return require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
              } catch {
                return require("../assets/image/card-cafe.jpg");
              }
            })();
            return (
              <div
                key={idx}
                className="bg-[#1B2021] shadow-lg rounded-md overflow-hidden font-montserrat"
              >
                <Link to={`/detailcafe/${cafe.nomor}`}>
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
                <div className="p-4 flex flex-col gap-2 text-[.95rem] text-[#E3DCC2]">
                  <div className="flex items-center gap-2">
                    <FaLocationDot />
                    <p>{cafe.alamat}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaStar />
                    <p>{cafe.rating}</p>
                  </div>
                  {cafe.distance && (
                    <p>
                      Berjarak <strong>{cafe.distance}</strong> dari lokasi Anda
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
