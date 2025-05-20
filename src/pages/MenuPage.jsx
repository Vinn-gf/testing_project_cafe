import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../utils/api_endpoints";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ColorRing } from "react-loader-spinner";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import {
  FaRegHeart,
  FaHeart,
  FaSortAmountUpAlt,
  FaSortAmountDownAlt,
} from "react-icons/fa";

function normalizeFavorites(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const MenuPage = () => {
  const { id: cafeId } = useParams();
  const navigate = useNavigate();
  const userId = CookieStorage.get(CookieKeys.UserToken);

  const [cafeName, setCafeName] = useState("");
  const [menus, setMenus] = useState([]);
  const [likedMenus, setLikedMenus] = useState(new Set());
  const [visitedCafes, setVisitedCafes] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all"); // all | Makanan | Minuman
  const [sortOrder, setSortOrder] = useState(null); // 'asc' or 'desc'
  const [isOpen, setIsOpen] = useState(false);

  const itemsPerPage = 9;

  // 1) fetch cafe name
  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_DETAIL_CAFE}${cafeId}`
      )
      .then(({ data }) => setCafeName(data.nama_kafe))
      .catch(() => {});
  }, [cafeId]);

  // 2) fetch menus + user’s favorites & visited cafes
  useEffect(() => {
    async function load() {
      try {
        // menus
        const { data: menuData } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_MENU_BY_ID}${cafeId}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setMenus(menuData);

        // user record
        const { data: user } = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}/api/users/${userId}`
        );

        // favorites
        const favArray = normalizeFavorites(user.menu_yang_disukai);
        const favSet = new Set(
          favArray
            .filter((e) => Number(e.id_cafe) === Number(cafeId))
            .map((e) => e.nama_menu)
        );
        setLikedMenus(favSet);

        // visited cafes (comma-separated string)
        const rawVisited = user.cafe_telah_dikunjungi || "";
        const visitedList = rawVisited
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        setVisitedCafes(new Set(visitedList));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [cafeId, userId]);

  // format currency
  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(number);

  // 3) apply search + category filter
  let filtered = menus
    .filter((m) =>
      m.nama_menu.toLowerCase().includes(searchKeyword.toLowerCase())
    )
    .filter((m) => {
      if (categoryFilter === "all") return true;
      return m.kategori === categoryFilter;
    });

  // 4) apply sort by price
  if (sortOrder) {
    filtered = [...filtered].sort((a, b) => {
      const pa = Number(a.harga);
      const pb = Number(b.harga);
      return sortOrder === "asc" ? pa - pb : pb - pa;
    });
  }

  // pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentMenus = filtered.slice(startIdx, startIdx + itemsPerPage);

  const handlePrev = () => currentPage > 1 && setCurrentPage((p) => p - 1);
  const handleNext = () =>
    currentPage < totalPages && setCurrentPage((p) => p + 1);

  // only add favorite, no unlike—and only if user has visited this cafe
  const addFavorite = async (item) => {
    if (!visitedCafes.has(cafeName)) return;
    if (likedMenus.has(item.nama_menu)) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_URL_SERVER}/api/user/favorite_menu`,
        {
          user_id: userId,
          id_cafe: cafeId,
          nama_menu: item.nama_menu,
          harga: item.harga,
        },
        { headers: { "ngrok-skip-browser-warning": true } }
      );
      setLikedMenus((prev) => new Set(prev).add(item.nama_menu));
    } catch (e) {
      console.error("Failed to add favorite:", e);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#2D3738]">
        <ColorRing
          visible
          height="80"
          width="80"
          ariaLabel="loading-menu"
          colors={["#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2", "#E3DCC2"]}
        />
      </div>
    );
  }
  if (error) {
    return <p className="text-center text-red-500 mt-10">Error: {error}</p>;
  }

  return (
    <div className="bg-[#2D3738] min-h-screen overflow-hidden font-montserrat">
      {/* Navbar */}
      <div className="bg-[#1B2021] p-4">
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
            <h1
              className="block p-2 text-[#E3DCC2] hover:cursor-pointer"
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

      {/* Search & Show All */}
      <div className="px-4">
        <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto mt-4 mb-6 flex flex-col justify-between sm:flex-row items-start sm:items-center gap-2">
          <input
            type="text"
            placeholder="Enter your menu..."
            className="p-2 rounded-md outline-none bg-[#1B2021] text-[#E3DCC2] w-full sm:w-2/3 md:w-1/3"
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
          />
          <Link to="/allcafes" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D]">
              Show All Cafes
            </button>
          </Link>
        </div>
      </div>

      {/* Page Title */}
      <div className="px-4">
        <h1 className="text-2xl font-bold text-[#E3DCC2] lg:w-[90%] md:w-full sm:w-full mb-4 mx-auto">
          Menu {cafeName || `#${cafeId}`}
        </h1>
      </div>

      {/* Category + Sort Buttons */}
      <div className="px-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 md:w-[95%] lg:w-[85%] sm:w-[90%] mx-auto">
          {["all", "Makanan", "Minuman"].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
              className={`py-1 px-4 rounded-full font-semibold ${
                categoryFilter === cat
                  ? "bg-[#E3DCC2] text-[#1B2021]"
                  : "bg-[#1B2021] text-[#E3DCC2] hover:bg-[#51513D]"
              }`}
            >
              {cat === "all"
                ? "All"
                : cat === "Makanan"
                ? "Foods"
                : "Beverages"}
            </button>
          ))}
          <FaSortAmountUpAlt
            onClick={() => setSortOrder("asc")}
            className={`cursor-pointer text-xl ${
              sortOrder === "asc" ? "text-[#E3DCC2]" : "text-gray-500"
            }`}
            title="Cheapest first"
          />
          <FaSortAmountDownAlt
            onClick={() => setSortOrder("desc")}
            className={`cursor-pointer text-xl ${
              sortOrder === "desc" ? "text-[#E3DCC2]" : "text-gray-500"
            }`}
            title="Most expensive first"
          />
        </div>
      </div>

      {/* Menu Grid */}
      <div className="px-4 pb-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentMenus.map((item) => (
            <div
              key={item.id_menu}
              className="bg-[#1B2021] p-4 rounded-lg shadow-md relative"
            >
              <button
                onClick={() => addFavorite(item)}
                disabled={
                  !visitedCafes.has(cafeName) || likedMenus.has(item.nama_menu)
                }
                className="absolute top-2 right-2 text-red-500 text-xl disabled:opacity-50"
                aria-label="Like menu"
              >
                {likedMenus.has(item.nama_menu) ? <FaHeart /> : <FaRegHeart />}
              </button>
              <h3 className="font-bold text-lg text-[#E3DCC2] mb-2">
                {item.nama_menu}
              </h3>
              <p className="text-[#E3DCC2]">
                Harga: {formatRupiah(item.harga)}
              </p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-[#e3dcc2]">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
