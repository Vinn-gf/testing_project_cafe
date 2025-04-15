import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { API_ENDPOINTS } from "../utils/api_endpoints";
import { Link } from "react-router-dom";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID not found. Please login again.");
        return;
      }
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/${API_ENDPOINTS.GET_USER_BY_ID}${userId}`
        );
        setUser(response.data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUserData();
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#1B2021] flex justify-center items-center font-montserrat text-red-500">
        {error}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1B2021] flex justify-center items-center font-montserrat text-[#E3DCC2]">
        Loading...
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Navbar */}
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] mx-auto flex justify-between items-center text-[#E3DCC2]">
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

      {/* Search Section */}
      <div className="px-4 w-[90%] mx-auto flex items-center justify-between">
        <form
          onSubmit={handleSearch}
          className="mt-4 w-[100%] mb-2 flex items-center font-montserrat gap-2"
        >
          <input
            className="search-input p-2 rounded-md outline-none text-[#E3DCC2] w-[30%] bg-[#1B2021] font-montserrat"
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
          <button className="check-cafe-btn w-[10em] text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D]">
            Show All Cafes
          </button>
        </Link>
      </div>
      {/* Search Section */}

      {/* Profile Section */}
      <div className="container text-[#e3dcc2] w-[90%] mx-auto my-[5rem] p-4 rounded-lg font-montserrat flex items-center justify-center">
        <div className="max-w-lg w-full bg-[#1B2021] shadow-xl rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">Profile</h1>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="font-semibold">Username:</span>
              <span>{user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Preferensi Jarak Minimal:</span>
              <span>
                {user.preferensi_jarak_minimal
                  ? `${user.preferensi_jarak_minimal} Km`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Preferensi Jarak Maksimal:</span>
              <span>
                {user.preferensi_jarak_maksimal
                  ? `${user.preferensi_jarak_maksimal} Km`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Preferensi Fasilitas:</span>
              <span>{user.preferensi_fasilitas || "-"}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Profile Section */}
    </div>
  );
};

export default ProfilePage;
