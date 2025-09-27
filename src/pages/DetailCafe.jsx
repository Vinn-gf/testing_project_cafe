// DetailCafe.jsx
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

  const baseUrl = (process.env.REACT_APP_URL_SERVER || "").replace(/\/$/, "");

  // --- Helper: Haversine formula (returns meters) ---
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const a1 = Number(lat1);
    const o1 = Number(lon1);
    const a2 = Number(lat2);
    const o2 = Number(lon2);
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

  // Utility to safely parse JSON strings (returns array/object or null)
  const safeParse = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return v;
    if (typeof v !== "string") return String(v);
    const t = v.trim();
    if (t === "") return null;
    try {
      return JSON.parse(t);
    } catch {
      return v;
    }
  };

  // 1) Ambil detail kafe
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        setLoading(true);
        setError("");

        // prefer constant from API_ENDPOINTS, fallback ke /api/cafe/
        const detailPath = API_ENDPOINTS.GET_DETAIL_CAFE.replace(/\/$/, "");
        const resp = await axios.get(`${baseUrl}${detailPath}/${id}`, {
          headers: { "ngrok-skip-browser-warning": true },
        });
        setCafe(resp.data);
      } catch (err) {
        console.error("fetch cafe detail:", err);
        setError(
          err.response?.data?.error || err.message || "Failed fetching cafe"
        );
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCafe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 2) Ambil reviews untuk kafe ini + panggil sentiment API lalu merge/replace
  useEffect(() => {
    const fetchReviewsAndSentiment = async () => {
      try {
        const resp = await axios.get(
          `${baseUrl}${API_ENDPOINTS.GET_REVIEWS}${id}`,
          {
            headers: { "ngrok-skip-browser-warning": true },
          }
        );
        const rawReviews = Array.isArray(resp.data) ? resp.data : [];
        setReviews(rawReviews);

        // optional sentiment call
        try {
          const sentimentResp = await axios.get(
            `${baseUrl}/api/sentiment/${id}`,
            {
              headers: { "ngrok-skip-browser-warning": true },
              timeout: 10000,
            }
          );
          const analyzed = sentimentResp.data;
          if (Array.isArray(analyzed) && analyzed.length > 0) {
            setReviews(analyzed);
          } else if (analyzed && typeof analyzed === "object") {
            // Try to merge labelled sentiments into rawReviews
            const lookup = {};
            if (Array.isArray(analyzed.reviews)) {
              analyzed.reviews.forEach((a) => {
                const key = `${a.username ?? ""}||${a.ulasan ?? ""}`;
                lookup[key] = a.sentiment ?? a.label ?? null;
              });
            } else {
              Object.values(analyzed).forEach((a) => {
                if (a && typeof a === "object") {
                  const key = `${a.username ?? ""}||${a.ulasan ?? ""}`;
                  lookup[key] = a.sentiment ?? a.label ?? null;
                }
              });
            }

            const merged = rawReviews.map((r) => {
              const key = `${r.username ?? ""}||${r.ulasan ?? ""}`;
              const sentimentLabel = lookup[key] ?? r.sentiment ?? null;
              return { ...r, sentiment: sentimentLabel };
            });
            setReviews(merged);
          } else {
            setReviews(rawReviews);
          }
        } catch (sentErr) {
          console.warn("Sentiment API error:", sentErr?.message ?? sentErr);
          setReviews(rawReviews);
        }
      } catch (err) {
        console.error("fetch reviews:", err);
      }
    };
    if (cafe) fetchReviewsAndSentiment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // not logged in => nothing to fetch
        setUserPreferences(null);
        return;
      }

      try {
        const path = API_ENDPOINTS.GET_USER_BY_ID.replace(/\/$/, "");
        const resp = await axios.get(`${baseUrl}${path}/${userId}`, {
          headers: { "ngrok-skip-browser-warning": true },
        });
        const data = resp.data || {};
        let visitedArr = [];

        // cafe_telah_dikunjungi may be a JSON string or already array or NULL
        const rawVisited =
          data.cafe_telah_dikunjungi ?? data.cafe_telah_dikunjungi_list ?? null;
        const parsed = safeParse(rawVisited);
        if (Array.isArray(parsed)) {
          visitedArr = parsed;
        } else {
          // Could be string with comma separation: try fallback parse by regex for numbers
          visitedArr = [];
        }

        setUserPreferences({
          ...data,
          cafe_telah_dikunjungi: visitedArr,
        });
      } catch (err) {
        console.warn("Failed fetching user preferences:", err?.message || err);
        setUserPreferences(null);
      }
    };
    fetchUserPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5) Hitung jarak ke kafe via Haversine
  useEffect(() => {
    const computeDistance = () => {
      if (!userLocation || !cafe) return;

      const userLat = Number(userLocation.latitude);
      const userLon = Number(userLocation.longitude);

      const cafeLat = cafe.latitude ?? cafe.lat ?? null;
      const cafeLon = cafe.longitude ?? cafe.lng ?? cafe.lon ?? null;

      const cLat = cafeLat !== null ? Number(cafeLat) : NaN;
      const cLon = cafeLon !== null ? Number(cafeLon) : NaN;

      if (
        !Number.isFinite(userLat) ||
        !Number.isFinite(userLon) ||
        !Number.isFinite(cLat) ||
        !Number.isFinite(cLon)
      ) {
        setError("Invalid coordinates. Distance calculation failed.");
        setDistance("N/A");
        setDistanceLoading(false);
        return;
      }

      setDistanceLoading(true);
      try {
        const meters = haversineMeters(userLat, userLon, cLat, cLon);
        if (!Number.isFinite(meters) || isNaN(meters)) {
          setDistance("N/A");
        } else {
          const formatted =
            meters < 1000
              ? `${Math.round(meters)} m`
              : `${(meters / 1000).toFixed(2)} km`;
          setDistance(formatted);
        }
      } catch (e) {
        console.error("Haversine error:", e);
        setDistance("N/A");
      } finally {
        setDistanceLoading(false);
      }
    };

    computeDistance();
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
  const totalPageReviews = Math.max(
    1,
    Math.ceil(totalReviews / reviewsPerPage)
  );
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = reviews.slice(indexOfFirstReview, indexOfLastReview);

  const handleNextPage = () => {
    if (currentPage < totalPageReviews) setCurrentPage((prev) => prev + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  // 8) Hitung array ID kafe yang sudah dikunjungi
  const visitedIds = Array.isArray(userPreferences?.cafe_telah_dikunjungi)
    ? userPreferences.cafe_telah_dikunjungi
        .map((v) => {
          if (v === null || v === undefined) return null;
          if (typeof v === "object")
            return Number(v.id_cafe ?? v.id ?? v.nomor ?? null);
          return Number(v);
        })
        .filter((x) => Number.isFinite(x))
    : [];

  const cafeId = cafe?.nomor ?? cafe?.id ?? cafe?.nomor_kafe ?? null;
  const alreadyVisited = cafeId ? visitedIds.includes(Number(cafeId)) : false;

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
    if (visitedIds.includes(Number(cafeId))) {
      setSuccess("Cafe already marked as visited.");
      return;
    }

    try {
      const resp = await axios.post(
        `${baseUrl}/api/visited/${userId}`,
        { id_cafe: Number(cafeId) },
        { headers: { "Content-Type": "application/json" } }
      );
      setSuccess(resp.data.message || "Cafe marked as visited successfully!");
      // locally update userPreferences
      setUserPreferences((prev) => {
        const prevVisited = Array.isArray(prev?.cafe_telah_dikunjungi)
          ? prev.cafe_telah_dikunjungi
          : [];
        return {
          ...(prev || {}),
          cafe_telah_dikunjungi: [...prevVisited, { id_cafe: Number(cafeId) }],
        };
      });
    } catch (err) {
      console.error("mark visited error:", err);
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

  // 11) Siapkan background image: prefer gambar_kafe field (serving via /uploads/cafes/), fallback ke local asset
  let backgroundImageUrl = "";
  if (
    cafe &&
    cafe.gambar_kafe &&
    typeof cafe.gambar_kafe === "string" &&
    cafe.gambar_kafe.trim() !== ""
  ) {
    const rel = cafe.gambar_kafe;
    if (rel.startsWith("/")) {
      backgroundImageUrl = `${baseUrl}${rel}`;
    } else {
      backgroundImageUrl = `${baseUrl}/${rel}`;
    }
  } else {
    try {
      backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
    } catch {
      try {
        backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
      } catch {
        backgroundImageUrl = ""; // no image
      }
    }
  }

  const sentimentBadgeClass = (label) => {
    if (!label) return "bg-gray-400 text-white";
    const l = String(label).toLowerCase();
    if (l.includes("pos") || l.includes("positive"))
      return "bg-green-500 text-white";
    if (l.includes("neg") || l.includes("negative"))
      return "bg-red-500 text-white";
    return "bg-yellow-400 text-black";
  };

  return (
    <div className="overflow-hidden bg-[#2D3738] min-h-screen">
      {/* Navbar */}
      <div className="p-4 bg-[#1B2021] font-montserrat">
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            RecSys.
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
            <Link to="/feedback" className="hover:text-gray-200">
              Feedback
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
              to="/feedback"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Feedback
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
              style={{
                backgroundImage: backgroundImageUrl
                  ? `url(${backgroundImageUrl})`
                  : undefined,
                backgroundColor: backgroundImageUrl ? undefined : "#111314",
              }}
            />
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
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {review.username}
                    <span
                      className={`text-sm px-2 py-1 rounded ${sentimentBadgeClass(
                        review.sentiment
                      )}`}
                      style={{ marginLeft: 8 }}
                    >
                      {review.sentiment
                        ? String(review.sentiment).toUpperCase()
                        : "N/A"}
                    </span>
                  </h3>
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
