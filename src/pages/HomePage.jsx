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

  // 1) Load cafes
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ALL_CAFES}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setCafes(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) Get user location via Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        setUserLocation({ latitude, longitude });
      },
      (err) => {
        setError("Failed to get location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // 3) Load user preferences
  useEffect(() => {
    const uid = CookieStorage.get(CookieKeys.UserToken);
    if (!uid) {
      setError("User ID not found—please login again.");
      return;
    }
    axios
      .get(
        `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_USER_BY_ID}${uid}`,
        {
          headers: { "ngrok-skip-browser-warning": true },
        }
      )
      .then(({ data }) => setUserPreferences(data))
      .catch((e) => setError(e.message));
  }, []);

  // 4) Compute distances & recommendations
  useEffect(() => {
    (async () => {
      if (!userLocation || !userPreferences || cafes.length === 0) return;
      const apiKey = process.env.REACT_APP_GOMAPS_API_KEY;
      const { latitude: uLat, longitude: uLng } = userLocation;

      const withDistance = await Promise.all(
        cafes.map(async (c) => {
          // Validate cafe coordinates
          if (!c.latitude || !c.longitude) {
            console.log(
              `Skipping cafe ${c.nama_kafe} due to missing coordinates.`
            );
            return { ...c, distance: "N/A" };
          }

          try {
            // Ensure coordinates are properly formatted without spaces
            const destinations = `${c.latitude},${c.longitude}`;
            const origins = `${uLat},${uLng}`;
            const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${destinations}&origins=${origins}&key=${apiKey}`;

            const { data } = await axios.get(url);

            if (data.status !== "OK") {
              throw new Error(`API Error: ${data.status}`);
            }

            const el = data.rows?.[0]?.elements?.[0] || {};
            return { ...c, distance: el.distance?.text || "N/A" };
          } catch (error) {
            console.error(
              `Error fetching distance for cafe ${c.nama_kafe}:`,
              error.message
            );
            return { ...c, distance: "N/A" };
          }
        })
      );

      const minM = parseFloat(userPreferences.preferensi_jarak_minimal) * 1000;
      const maxM = parseFloat(userPreferences.preferensi_jarak_maksimal) * 1000;
      const mid = (minM + maxM) / 2;
      const facs = userPreferences.preferensi_fasilitas
        .split(",")
        .map((s) => s.trim().toLowerCase());

      let filtered = withDistance.filter((c) => {
        const d = parseDistance(c.distance);
        return (
          d >= minM &&
          d <= maxM &&
          facs.every((f) => c.fasilitas?.toLowerCase().includes(f))
        );
      });

      if (filtered.length === 0) {
        filtered = withDistance
          .filter((c) =>
            facs.some((f) => c.fasilitas?.toLowerCase().includes(f))
          )
          .sort(
            (a, b) =>
              Math.abs(parseDistance(a.distance) - mid) -
              Math.abs(parseDistance(b.distance) - mid)
          );
      }

      setRecommendedCafes(filtered.slice(0, 6));
      setDistanceLoading(false);
    })();
  }, [userLocation, userPreferences, cafes]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  if (loading || distanceLoading || !userLocation) {
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
            className="md:hidden text-[#E3DCC2] focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden mx-auto w-[90%] space-y-2">
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
        <div className="relative z-10 mx-auto w-[90%] sm:w-[85%] md:w-[75%] lg:w-[60%]">
          <h1 className="font-montserrat text-4xl md:text-[4rem] font-bold text-[#E3DCC2] tracking-wide">
            Welcome.
          </h1>
          <p className="mt-2 font-poppins text-[#E3DCC2]">
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
              placeholder="Enter your cafe..."
              className="w-full sm:w-2/3 md:w-[30%] p-2 bg-[#1B2021] text-[#E3DCC2] rounded-md outline-none"
            />
            <button
              type="submit"
              className="w-full sm:w-auto py-2 px-4 bg-[#1B2021] text-[#E3DCC2] rounded-md hover:bg-[#51513D]"
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

      {/* Recommendations */}
      <div className="p-4">
        <h1 className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] mb-4 text-[1.4rem] font-bold font-montserrat text-[#e3dcc2]">
          Recommended Cafes Based on Your Preferences
        </h1>
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recommendedCafes.map((c, idx) => {
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
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
