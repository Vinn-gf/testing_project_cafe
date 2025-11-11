import React, { useEffect, useMemo, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import axios from "axios";
import { FaLocationDot, FaStar } from "react-icons/fa6";
import { API_ENDPOINTS } from "../utils/api_endpoints";

const baseUrl = "http://127.0.0.1:5000";

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
  const R = 6371000;

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

// facility options
const FACILITY_OPTIONS = [
  "Free Wi-Fi",
  "Toilet",
  "AC",
  "Buku",
  "Photobooth",
  "Carwash",
  "Bar",
  "Playground",
  "Live Music",
];

const RecommendationPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [enriched, setEnriched] = useState([]); // rec + detail (rating, fasilitas, lat/lon, distanceMeters)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(true);

  // ===== APPLIED STATES (dipakai untuk mengurutkan list) =====
  const [ratingHigh, setRatingHigh] = useState(false);
  const [ratingLow, setRatingLow] = useState(false);
  const [distNear, setDistNear] = useState(false);
  const [distFar, setDistFar] = useState(false);
  const [facilitiesMap, setFacilitiesMap] = useState(
    Object.fromEntries(FACILITY_OPTIONS.map((f) => [f, false]))
  );

  // ===== DRAFT STATES (hanya untuk UI modal) =====
  const [ratingHighDraft, setRatingHighDraft] = useState(false);
  const [ratingLowDraft, setRatingLowDraft] = useState(false);
  const [distNearDraft, setDistNearDraft] = useState(false);
  const [distFarDraft, setDistFarDraft] = useState(false);
  const [facilitiesMapDraft, setFacilitiesMapDraft] = useState(
    Object.fromEntries(FACILITY_OPTIONS.map((f) => [f, false]))
  );

  const userId = CookieStorage.get(CookieKeys.UserToken);
  const navigate = useNavigate();

  // 1) geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
      },
      (err) => {
        console.warn("Could not get your location:", err?.message || err);
        setUserLocation(null);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // 2) fetch recommendations
  useEffect(() => {
    if (!userId) {
      setError("User ID missing — please login");
      setLoading(false);
      return;
    }
    axios
      .get(`${baseUrl}/api/recommend/${userId}`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        timeout: 15000,
      })
      .then((resp) => {
        const recs =
          (resp.data && (resp.data.recommendations || resp.data.recs)) || [];
        setRecommendations(Array.isArray(recs) ? recs : []);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch recommendations.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // 3) enrich with cafe detail + distance
  useEffect(() => {
    const enrichAll = async () => {
      if (recommendations.length === 0) {
        setEnriched([]);
        setDistanceLoading(false);
        return;
      }
      setDistanceLoading(true);
      try {
        const rows = await Promise.all(
          recommendations.map(async (cafe) => {
            let info = {};
            try {
              const infoResp = await axios.get(
                `${process.env.REACT_APP_URL_SERVER}${
                  API_ENDPOINTS.GET_DETAIL_CAFE
                }${cafe.cafe_id ?? cafe.id ?? cafe.id_cafe ?? cafe.nomor}`,
                {
                  headers: { "ngrok-skip-browser-warning": "true" },
                  timeout: 10000,
                }
              );
              info = infoResp.data || {};
            } catch (e) {
              info = {};
            }

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

            let distanceMeters = NaN;
            if (
              userLocation &&
              Number.isFinite(latNum) &&
              Number.isFinite(lonNum)
            ) {
              distanceMeters = haversineMeters(
                userLocation.lat,
                userLocation.lng,
                latNum,
                lonNum
              );
            }

            const facStr = info.fasilitas ?? cafe.fasilitas ?? "";
            const facArr = String(facStr)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

            return {
              cafe_id:
                cafe.cafe_id ??
                cafe.id_cafe ??
                cafe.id ??
                info.nomor ??
                cafe.nomor,
              nama_kafe: cafe.nama_kafe ?? info.nama_kafe ?? cafe.name ?? "",
              alamat: cafe.alamat ?? info.alamat ?? "",
              rating: Number(cafe.rating ?? info.rating ?? 0) || 0,
              score: typeof cafe.score === "number" ? cafe.score : null,
              matched_menu: cafe.matched_menu ?? [],
              fasilitas: facArr,
              lat: latNum,
              lon: lonNum,
              distanceMeters,
              distanceText: Number.isFinite(distanceMeters)
                ? formatDistanceText(distanceMeters)
                : "N/A",
            };
          })
        );
        setEnriched(rows);
      } catch (e) {
        console.warn("Enrich failed:", e?.message || e);
      } finally {
        setDistanceLoading(false);
      }
    };
    enrichAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations, userLocation]);

  // ========== OPEN/CLOSE MODAL ==========
  const openFilterModal = () => {
    // sinkronkan draft dari applied
    setRatingHighDraft(ratingHigh);
    setRatingLowDraft(ratingLow);
    setDistNearDraft(distNear);
    setDistFarDraft(distFar);
    setFacilitiesMapDraft({ ...facilitiesMap });
    setShowFilter(true);
  };

  const closeFilterModal = () => setShowFilter(false);

  // ========== APPLY & RESET (draft) ==========
  const applyFilters = () => {
    // commit draft -> applied
    setRatingHigh(ratingHighDraft);
    setRatingLow(ratingLowDraft);
    setDistNear(distNearDraft);
    setDistFar(distFarDraft);
    setFacilitiesMap({ ...facilitiesMapDraft });
    setShowFilter(false);
  };

  const resetDraftFilters = () => {
    setRatingHighDraft(false);
    setRatingLowDraft(false);
    setDistNearDraft(false);
    setDistFarDraft(false);
    setFacilitiesMapDraft(
      Object.fromEntries(FACILITY_OPTIONS.map((f) => [f, false]))
    );
  };

  // Derived selected facilities (APPLIED)
  const selectedFacilities = useMemo(
    () =>
      Object.entries(facilitiesMap)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [facilitiesMap]
  );

  // 4) apply filters + sorting (top-6) — menggunakan APPLIED STATES
  const filteredSortedTop6 = useMemo(() => {
    if (!Array.isArray(enriched)) return [];

    // 4a) filter facilities (AND)
    const want = selectedFacilities.map((x) => x.toLowerCase());
    const passFacilities = (row) => {
      if (want.length === 0) return true;
      const facsLower = (row.fasilitas || []).map((s) => s.toLowerCase());
      return want.every((f) => facsLower.some((x) => x.includes(f)));
    };

    let rows = enriched.filter(passFacilities);
    const noCheckSelected =
      !ratingHigh && !ratingLow && !distNear && !distFar && want.length === 0;

    if (noCheckSelected) {
      rows.sort((a, b) => {
        const sa = typeof a.score === "number" ? a.score : -Infinity;
        const sb = typeof b.score === "number" ? b.score : -Infinity;
        return sb - sa;
      });
    } else {
      rows.sort((a, b) => {
        if (ratingHigh) {
          const d = (b.rating || 0) - (a.rating || 0);
          if (d !== 0) return d;
        } else if (ratingLow) {
          const d = (a.rating || 0) - (b.rating || 0);
          if (d !== 0) return d;
        }
        // distance
        if (distNear) {
          const da = Number.isFinite(a.distanceMeters)
            ? a.distanceMeters
            : Number.POSITIVE_INFINITY;
          const db = Number.isFinite(b.distanceMeters)
            ? b.distanceMeters
            : Number.POSITIVE_INFINITY;
          const d = da - db;
          if (d !== 0) return d;
        } else if (distFar) {
          const da = Number.isFinite(a.distanceMeters)
            ? a.distanceMeters
            : Number.NEGATIVE_INFINITY;
          const db = Number.isFinite(b.distanceMeters)
            ? b.distanceMeters
            : Number.NEGATIVE_INFINITY;
          const d = db - da;
          if (d !== 0) return d;
        }
        // tiebreak: score desc
        const sa = typeof a.score === "number" ? a.score : -Infinity;
        const sb = typeof b.score === "number" ? b.score : -Infinity;
        return sb - sa;
      });
    }

    return rows.slice(0, 6);
  }, [enriched, selectedFacilities, ratingHigh, ratingLow, distNear, distFar]);

  // ===== HANDLERS (DRAFT) — mutual exclusive rating & distance =====
  const onToggleRatingHighDraft = () => {
    setRatingHighDraft((v) => {
      const nv = !v;
      if (nv) setRatingLowDraft(false);
      return nv;
    });
  };
  const onToggleRatingLowDraft = () => {
    setRatingLowDraft((v) => {
      const nv = !v;
      if (nv) setRatingHighDraft(false);
      return nv;
    });
  };
  const onToggleDistNearDraft = () => {
    setDistNearDraft((v) => {
      const nv = !v;
      if (nv) setDistFarDraft(false);
      return nv;
    });
  };
  const onToggleDistFarDraft = () => {
    setDistFarDraft((v) => {
      const nv = !v;
      if (nv) setDistNearDraft(false);
      return nv;
    });
  };
  const toggleFacilityDraft = (fac) => {
    setFacilitiesMapDraft((prev) => ({ ...prev, [fac]: !prev[fac] }));
  };

  if (loading || (recommendations.length > 0 && distanceLoading)) {
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
            <Link
              to="/feedback"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Feedback
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

      {/* Header + Controls */}
      <div className="w-[90%] mx-auto mt-6 text-[#E3DCC2] font-montserrat">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-2xl font-semibold">Recommendations for You</h2>
          <div className="flex gap-3">
            <button
              onClick={openFilterModal}
              className="bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D]"
            >
              Filter
            </button>
            <button
              onClick={() => navigate("/allcafes")}
              className="bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D]"
            >
              Show All Cafes
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="w-[90%] mx-auto mt-4 mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredSortedTop6.length < 1 ? (
          <p className="text-gray-400 font-montserrat col-span-full">
            No recommendations available.
          </p>
        ) : (
          filteredSortedTop6.map((cafe) => {
            let imgSrc;
            try {
              imgSrc = require(`../assets/image/card-cafe-${cafe.cafe_id}.jpg`);
            } catch {
              imgSrc = require(`../assets/image/card-cafe.jpg`);
            }
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
                  {typeof cafe.score === "number" && (
                    <div className="text-[#e3dcc2] text-[.95rem]">
                      Score: <strong>{cafe.score.toFixed(2)}</strong>
                    </div>
                  )}
                  {Number.isFinite(cafe.distanceMeters) && (
                    <div className="text-[#e3dcc2] text-[.95rem]">
                      Berjarak <strong>{cafe.distanceText}</strong> dari lokasi
                      Anda
                    </div>
                  )}
                  {cafe.fasilitas && cafe.fasilitas.length > 0 && (
                    <div className="text-[#e3dcc2] text-[.95rem]">
                      Fasilitas: <strong>{cafe.fasilitas.join(", ")}</strong>
                    </div>
                  )}
                  {Array.isArray(cafe.matched_menu) &&
                    cafe.matched_menu.length > 0 && (
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

      {/* Filter Modal */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={closeFilterModal}
          />
          {/* dialog */}
          <div className="relative z-10 w-[92%] max-w-2xl bg-[#1B2021] text-[#E3DCC2] rounded-xl p-5 shadow-xl font-montserrat">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Filter Rekomendasi</h3>
              <button
                onClick={closeFilterModal}
                className="px-3 py-1 rounded-md bg-[#2D3738] hover:bg-[#51513D]"
              >
                Close
              </button>
            </div>

            {/* Rating */}
            <div className="mb-4">
              <p className="mb-2 font-medium">Urutkan Rating</p>
              <div className="flex flex-wrap gap-3">
                <label
                  className={`flex justify-center px-3 py-2 rounded-md border cursor-pointer ${
                    ratingHighDraft
                      ? "bg-[#51513D] border-[#51513D]"
                      : "bg-[#2D3738] border-[#3a3f40]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2 accent-[#51513D]"
                    checked={ratingHighDraft}
                    onChange={onToggleRatingHighDraft}
                  />
                  Tertinggi
                </label>
                <label
                  className={`flex justify-center px-3 py-2 rounded-md border cursor-pointer ${
                    ratingLowDraft
                      ? "bg-[#51513D] border-[#51513D]"
                      : "bg-[#2D3738] border-[#3a3f40]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2 accent-[#51513D]"
                    checked={ratingLowDraft}
                    onChange={onToggleRatingLowDraft}
                  />
                  Terendah
                </label>
              </div>
            </div>

            {/* Distance */}
            <div className="mb-4">
              <p className="mb-2 font-medium">Urutkan Jarak</p>
              <div className="flex flex-wrap gap-3">
                <label
                  className={`flex justify-center px-3 py-2 rounded-md border cursor-pointer ${
                    distNearDraft
                      ? "bg-[#51513D] border-[#51513D]"
                      : "bg-[#2D3738] border-[#3a3f40]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2 accent-[#51513D]"
                    checked={distNearDraft}
                    onChange={onToggleDistNearDraft}
                    disabled={!userLocation}
                  />
                  Terdekat {userLocation ? "" : "(butuh lokasi)"}
                </label>
                <label
                  className={`flex justify-center px-3 py-2 rounded-md border cursor-pointer ${
                    distFarDraft
                      ? "bg-[#51513D] border-[#51513D]"
                      : "bg-[#2D3738] border-[#3a3f40]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2 accent-[#51513D]"
                    checked={distFarDraft}
                    onChange={onToggleDistFarDraft}
                    disabled={!userLocation}
                  />
                  Terjauh {userLocation ? "" : "(butuh lokasi)"}
                </label>
              </div>
            </div>

            {/* Facilities */}
            <div className="mb-4">
              <p className="mb-2 font-medium">Fasilitas</p>
              <div className="flex flex-wrap gap-2">
                {FACILITY_OPTIONS.map((fac) => (
                  <label
                    key={fac}
                    className={`text-sm px-2 flex justify-center py-1 rounded-md border cursor-pointer ${
                      facilitiesMapDraft[fac]
                        ? "bg-[#51513D] border-[#51513D]"
                        : "bg-[#2D3738] border-[#3a3f40]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1 accent-[#51513D]"
                      checked={!!facilitiesMapDraft[fac]}
                      onChange={() => toggleFacilityDraft(fac)}
                    />
                    {fac}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={resetDraftFilters}
                className="px-4 py-2 rounded-md bg-[#2D3738] hover:bg-[#3a3f40]"
              >
                Reset Filter
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 rounded-md bg-[#51513D] hover:bg-[#6b6a4d]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationPage;
