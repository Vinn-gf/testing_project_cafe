// src/pages/SearchCafePage.jsx

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { ColorRing } from "react-loader-spinner";
import axios from "axios";
import { API_ENDPOINTS } from "../utils/api_endpoints";

const SearchCafePage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { keyword } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const cafesPerPage = 6;
  const navigate = useNavigate();

  // Fetch search results when `keyword` changes
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_SEARCH_CAFE}${keyword}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setResults(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCafe();
  }, [keyword]);

  // Handle the search form submission
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  // Pagination calculations
  const totalCafes = results.length;
  const totalPages = Math.ceil(totalCafes / cafesPerPage);
  const indexOfLastCafe = currentPage * cafesPerPage;
  const indexOfFirstCafe = indexOfLastCafe - cafesPerPage;
  const currentCafes = results.slice(indexOfFirstCafe, indexOfLastCafe);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  if (loading) {
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

  if (error) {
    return <p className="text-center text-red-500 mt-10">Error: {error}</p>;
  }

  return (
    <div className="w-full min-h-screen bg-[#2D3738]">
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

      {/* Search + Show All Cafes */}
      <div className="px-4">
        <form
          onSubmit={handleSearch}
          className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto mt-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 font-montserrat"
        >
          <input
            type="text"
            placeholder="Enter your cafe..."
            className="search-input p-2 rounded-md outline-none bg-[#1B2021] text-[#E3DCC2] w-full sm:w-2/3 md:w-1/3"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <button
            type="submit"
            className="search-btn bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D] w-full sm:w-auto"
          >
            Search
          </button>
          <Link to="/allcafes">
            <button className="check-cafe-btn w-36 text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D] font-montserrat">
              Show All Cafes
            </button>
          </Link>
        </form>
      </div>
      {/* /Search }

      {/* Results Section */}
      <div className="px-4 pb-8">
        <h1 className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto font-montserrat font-bold text-[1.4rem] text-[#e3dcc2] mb-4">
          Search Results for "{keyword}"
        </h1>

        {results.length === 0 ? (
          <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto">
            <p className="text-[#e3dcc2]">No results found.</p>
          </div>
        ) : (
          <>
            <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentCafes.map((cafe, idx) => {
                let backgroundImageUrl;
                try {
                  backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
                } catch {
                  backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
                }
                return (
                  <div
                    key={idx}
                    className="search-card-container bg-[#1B2021] rounded-md overflow-hidden shadow-md font-montserrat"
                  >
                    <Link to={`/detailcafe/${cafe.nomor}`}>
                      <div
                        className="relative h-[21rem] bg-cover bg-center rounded-t-md"
                        style={{
                          backgroundImage: `url(${backgroundImageUrl})`,
                        }}
                      >
                        <div className="text-[#E3DCC2] absolute bottom-0 inset-x-0 bg-black bg-opacity-50 p-2 h-[18%]">
                          <h1 className="text-[1.2rem] font-extrabold">
                            {cafe.nama_kafe}
                          </h1>
                          <p className="text-[0.9rem] font-normal">
                            {cafe.alamat}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Pagination Section */}
            <div className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto flex flex-col sm:flex-row justify-center items-center mt-8 gap-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-[#e3dcc2]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
      {/* /Results Section */}
    </div>
  );
};

export default SearchCafePage;
