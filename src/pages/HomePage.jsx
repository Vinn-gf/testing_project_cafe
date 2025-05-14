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
  if (parts[1] && parts[1].toLowerCase() === "km") return num * 1000;
  return num;
};

const HomePage = () => {
  const [cafes, setCafes] = useState([]); // tetap sebagai data awal
  const [recommendedCafes, setRecommendedCafes] = useState([]); // state baru untuk hasil filter
  const [userLocation, setUserLocation] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();

  // 1) fetch semua café sekali
  useEffect(() => {
    const fetchCafes = async () => {
      try {
        const resp = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ALL_CAFES}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setCafes(resp.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCafes();
  }, []);

  // 2) ambil lokasi user sekali
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("Error getting user location:", error),
        {
          enableHighAccuracy: true, // pakai GPS kalau tersedia
          maximumAge: 0, // jangan pakai posisi yang di-cache
          timeout: 10000, // batalkan kalau lebih dari 10 detik
        }
      );
    }
  }, []);

  // 3) fetch preferensi user sekali
  useEffect(() => {
    const fetchUserPreferences = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID tidak ditemukan. Silakan login kembali.");
        return;
      }
      try {
        const resp = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_USER_BY_ID}${userId}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setUserPreferences(resp.data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUserPreferences();
  }, []);

  // 4) hanya triggered saat semua data sudah tersedia, TAPI TIDAK lagi tergantung pada `recommendedCafes`
  useEffect(() => {
    const fetchDistancesAndFilter = async () => {
      if (!userLocation || cafes.length === 0 || !userPreferences) return;

      const apiKey = process.env.REACT_APP_GOMAPS_API_KE;
      const { latitude: uLat, longitude: uLong } = userLocation;

      const withDistance = await Promise.all(
        cafes.map(async (cafe) => {
          const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafe.latitude} , ${cafe.longitude}&origins=${uLat} , ${uLong}&key=${apiKey}`;
          try {
            const { data } = await axios.get(url);
            const el = data.rows?.[0]?.elements?.[0];
            return {
              ...cafe,
              distance: el?.distance?.text || "N/A",
              duration: el?.duration?.text || "N/A",
            };
          } catch {
            return { ...cafe, distance: "N/A", duration: "N/A" };
          }
        })
      );

      const minM = parseFloat(userPreferences.preferensi_jarak_minimal) * 1000;
      const maxM = parseFloat(userPreferences.preferensi_jarak_maksimal) * 1000;
      const facs = userPreferences.preferensi_fasilitas
        ? userPreferences.preferensi_fasilitas
            .split(",")
            .map((s) => s.trim().toLowerCase())
        : [];

      let filtered = withDistance.filter((c) => {
        const d = parseDistance(c.distance);
        const inRange = d >= minM && d <= maxM;
        const hasFac = facs.length
          ? facs.some((f) => c.fasilitas?.toLowerCase().includes(f))
          : true;
        return inRange && hasFac;
      });

      if (filtered.length === 0) {
        filtered = withDistance
          .filter((c) =>
            facs.length
              ? facs.some((f) => c.fasilitas?.toLowerCase().includes(f))
              : true
          )
          .sort(
            (a, b) => parseDistance(a.distance) - parseDistance(b.distance)
          );
      } else {
        filtered.sort(
          (a, b) => parseDistance(a.distance) - parseDistance(b.distance)
        );
      }

      setRecommendedCafes(filtered.slice(0, 6));
      setDistanceLoading(false);
    };

    fetchDistancesAndFilter();
  }, [userLocation, cafes, userPreferences]); // NOTE: tidak tergantung pada recommendedCafes

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  // 5) render
  if (loading || distanceLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#2D3738]">
        <ColorRing
          visible={true}
          height="80"
          width="80"
          ariaLabel="color-ring-loading"
          wrapperStyle={{}}
          wrapperClass="color-ring-wrapper"
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
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] text-[#E3DCC2] mx-auto flex justify-between items-center">
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
            <Link to="/profile" className="block p-2 text-[#E3DCC2]">
              Profile
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Hero */}
      <div className="hero-section relative bg-cover bg-(url['../assets/image/hero-bg2.jpg']) bg-center px-4 py-8 h-[65vh]">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 w-[90%] mx-auto">
          <h1 className="welcome-text font-montserrat text-[#E3DCC2] font-bold text-[4rem] tracking-wide">
            Welcome.
          </h1>
          <p className="text-[#E3DCC2] font-poppins">
            find your comfort and happy place.
          </p>
          <div className="">
            <form
              onSubmit={handleSearch}
              className="mt-4 mb-2 flex items-center font-montserrat gap-2"
            >
              <input
                className="search-input p-2 rounded-md outline-none text-[#E3DCC2] bg-[#1B2021] w-[30%] font-montserrat"
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
          </div>
          <Link to="/allcafes">
            <button className="check-cafe-btn mt-[5rem] w-[10em] text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D]">
              Show All Cafes
            </button>
          </Link>
        </div>
      </div>
      {/* Hero */}

      {/* Recommendation Section */}
      <div className="p-4">
        <div className="w-[90%] mx-auto">
          <h1 className="text-[#e3dcc2] font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
            Recommended Cafes Based on Your Preferences
          </h1>
        </div>
        <div className="recommendation-section w-[90%] mx-auto flex flex-wrap items-center gap-[1.25rem]">
          {recommendedCafes.map((cafe, index) => {
            let backgroundImageUrl;
            try {
              backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
            } catch (error) {
              backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
            }
            return (
              <div
                key={index}
                className="recommendation-card-container bg-[#1B2021] shadow-lg hover:cursor-pointer rounded-md w-[32%] h-full overflow-hidden text-[#E3DCC2] font-montserrat"
              >
                <Link to={`/detailcafe/${cafe.nomor}`}>
                  <div
                    className="relative h-[15rem] rounded-t-md bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <h1 className="text-sm font-bold text-[1.3rem]">
                        {cafe.nama_kafe}
                      </h1>
                    </div>
                  </div>
                </Link>
                <div className="p-4 flex-col items-center gap-4 text-[.95rem]">
                  <div className="location-text flex gap-2">
                    <span className="flex items-center relative -top-[0.05rem]">
                      <FaLocationDot />
                    </span>
                    <p>{cafe.alamat}</p>
                  </div>
                  <div className="rating-text flex gap-2">
                    <span className="flex items-center relative -top-[0.05rem]">
                      <FaStar />
                    </span>
                    <p>{cafe.rating}</p>
                  </div>
                  {cafe.distance && cafe.duration ? (
                    <div>
                      <h1>
                        Berjarak <strong>{cafe.distance}</strong> dari lokasi
                        anda
                      </h1>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Recommendation Section */}
    </div>
  );
};

export default HomePage;
