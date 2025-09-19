// src/pages/HomePage.jsx
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
  const R = 6371000; // Earth radius in meters

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

const RECOMMEND_API =
  process.env.REACT_APP_RECOMMEND_URL || "http://localhost:5000";

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
        setCafes(Array.isArray(data) ? data : []);
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

  // 3) Load user preferences (and visited history inside user object)
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

  // Helper: determines if user has visited history
  const userHasVisited = (prefs) => {
    if (!prefs) return false;
    try {
      const raw =
        prefs.cafe_telah_dikunjungi ?? prefs.cafe_telah_dikunjungi_list ?? null;
      if (!raw) return false;
      // could be JSON string or array
      if (typeof raw === "string") {
        const arr = JSON.parse(raw || "[]");
        return Array.isArray(arr) && arr.length > 0;
      }
      return Array.isArray(raw) && raw.length > 0;
    } catch {
      return false;
    }
  };

  // 4) Decide: demographic filtering OR UBCF recommendations
  useEffect(() => {
    (async () => {
      if (!userLocation || !userPreferences || cafes.length === 0) return;

      setDistanceLoading(true);
      const uid = CookieStorage.get(CookieKeys.UserToken);

      // If user has visited history -> use UBCF recommendations from RECOMMEND_API
      const hasVisited = userHasVisited(userPreferences);

      if (hasVisited) {
        // Try fetch UBCF recommendations
        try {
          const resp = await axios.get(`${RECOMMEND_API}/api/recommend/${uid}`);
          const recs = resp.data?.recommendations ?? [];
          // recs format: array of { cafe_id, nama_kafe, alamat, rating, score, matched_menu, ... }
          // We'll compute distances (haversine) per cafe_id by fetching cafe detail
          const distancesMap = {};
          const enriched = await Promise.all(
            recs.map(async (r) => {
              const cafeId =
                r.cafe_id ?? r.cafe_id ?? r.cafe ?? r.id_cafe ?? null;
              let info = null;
              try {
                const infoResp = await axios.get(
                  `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_DETAIL_CAFE}${cafeId}`,
                  { headers: { "ngrok-skip-browser-warning": true } }
                );
                info = infoResp.data || {};
              } catch (err) {
                info = {};
              }

              // try various coordinate fields
              const latitude =
                info.latitude ??
                info.lat ??
                info.lintang ??
                info.latitude_cafe ??
                info.latitude_kafe ??
                null;
              const longitude =
                info.longitude ??
                info.lon ??
                info.lng ??
                info.bujur ??
                info.longitude_cafe ??
                info.longitude_kafe ??
                null;

              const latNum = latitude !== null ? Number(latitude) : NaN;
              const lonNum = longitude !== null ? Number(longitude) : NaN;

              let distText = "N/A";
              if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
                const meters = haversineMeters(
                  userLocation.latitude,
                  userLocation.longitude,
                  latNum,
                  lonNum
                );
                distText = formatDistanceText(meters);
              }

              distancesMap[cafeId] = distText;

              // Normalize object so rendering easier: provide fields similar to demographic branch
              return {
                source: "ubcf",
                cafe_id: cafeId,
                nomor: cafeId, // keep `nomor` for link route compatibility
                nama_kafe: r.nama_kafe ?? info.nama_kafe ?? r.name ?? "",
                alamat: r.alamat ?? info.alamat ?? "",
                rating: r.rating ?? info.rating ?? 0,
                distance: distText,
                matched_menu: r.matched_menu ?? r.matched_menu ?? [],
                // do NOT show score on homepage; still keep it internally if needed
                _score: r.score ?? null,
              };
            })
          );

          setRecommendedCafes(enriched.slice(0, 6));
          setDistanceLoading(false);
          return;
        } catch (err) {
          // if recommend API fails, fallback to demographic filtering
          console.warn(
            "UBCF recommend fetch failed, fallback to demographic:",
            err?.message || err
          );
        }
      }

      // --- demographic filtering fallback (or when no history) ---
      try {
        const { latitude: uLat, longitude: uLng } = userLocation;

        const withDistance = cafes.map((c) => {
          // Robust extraction of cafe coordinates (try several field names)
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

          const cLat = cafeLat !== null ? Number(cafeLat) : NaN;
          const cLon = cafeLon !== null ? Number(cafeLon) : NaN;

          if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) {
            // missing/invalid coords
            return { ...c, distance: "N/A" };
          }

          const meters = haversineMeters(uLat, uLng, cLat, cLon);
          if (!Number.isFinite(meters) || isNaN(meters)) {
            return { ...c, distance: "N/A" };
          }
          const formatted =
            meters < 1000
              ? `${Math.round(meters)} m`
              : `${(meters / 1000).toFixed(2)} km`;
          return { ...c, distance: formatted };
        });

        // Parse preferences distances (assume preferences stored in km as before)
        const minPrefKm = parseFloat(userPreferences.preferensi_jarak_minimal);
        const maxPrefKm = parseFloat(userPreferences.preferensi_jarak_maksimal);

        // If invalid, fall back to wide default range
        const minM = Number.isFinite(minPrefKm) ? minPrefKm * 1000 : 0;
        const maxM = Number.isFinite(maxPrefKm)
          ? maxPrefKm * 1000
          : Number.POSITIVE_INFINITY;
        const mid = (minM + maxM) / 2;

        const facsRaw = userPreferences.preferensi_fasilitas || "";
        const facs = facsRaw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        // Filter by distance and facilities
        let filtered = withDistance.filter((c) => {
          const d = parseDistance(c.distance);
          const facilitiesOk =
            facs.length === 0 ||
            facs.every((f) => (c.fasilitas ?? "").toLowerCase().includes(f));
          return d >= minM && d <= maxM && facilitiesOk;
        });

        if (filtered.length === 0) {
          // fallback: pick cafes that have at least one facility and sort by closeness to mid
          filtered = withDistance
            .filter((c) =>
              facs.some((f) => (c.fasilitas ?? "").toLowerCase().includes(f))
            )
            .sort(
              (a, b) =>
                Math.abs(parseDistance(a.distance) - mid) -
                Math.abs(parseDistance(b.distance) - mid)
            );
        }

        // Tag as demographic source to be able to conditionally render score etc.
        const tagged = filtered.map((x) => ({ ...x, source: "demographic" }));
        setRecommendedCafes(tagged.slice(0, 6));
      } catch (e) {
        console.error("Error computing distances/recommendations:", e);
        setError("Failed to compute recommendations.");
      } finally {
        setDistanceLoading(false);
      }
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
          {recommendedCafes.length < 1 ? (
            <p className="text-gray-400 font-montserrat col-span-full">
              No recommendations available.
            </p>
          ) : (
            recommendedCafes.map((c, idx) => {
              const img = (() => {
                try {
                  return require(`../assets/image/card-cafe-${c.nomor}.jpg`);
                } catch {
                  return require(`../assets/image/card-cafe.jpg`);
                }
              })();

              // fields vary by source: demographic uses c.nomor, ubcf uses c.cafe_id (we already set nomor)
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

                    {/* If demographic branch show nothing special (kept previous behavior).
                        If you later want to display demographic score, you can add it here.
                        IMPORTANT: when source === 'ubcf' do NOT display score on Homepage. */}
                    {c.source !== "ubcf" && c.score && (
                      <p>
                        Score: <strong>{c.score}</strong>
                      </p>
                    )}

                    {c.distance && (
                      <p>
                        Berjarak <strong>{c.distance}</strong> dari lokasi Anda
                      </p>
                    )}

                    {c.matched_menu && c.matched_menu.length > 0 && (
                      <div className="text-[#e3dcc2] text-[.95rem]">
                        Menu: <strong>{c.matched_menu.join(", ")}</strong>
                      </div>
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

export default HomePage;
