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
  const navigate = useNavigate();

  // useEffect(() => {
  //   fetch(`${process.env.REACT_APP_URL_SERVER}api/search/${keyword}`)
  //     .then((res) => res.json())
  //     .then((data) => {
  //       console.log("Search Results:", data);
  //       setResults(data);
  //     })
  //     .catch((error) => console.error("Error fetching search results:", error));
  // }, [keyword]);

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_SEARCH_CAFE}${keyword}`,
          {
            headers: {
              "ngrok-skip-browser-warning": true,
            },
          }
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

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  if (loading) {
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
    return <p>Error: {error}</p>;
  }

  return (
    <div className="bg-[#2D3738]">
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

      <div className="p-4">
        <div className="head-section w-[90%] mx-auto flex items-center justify-between mb-4">
          <h1 className="font-montserrat font-bold text-[1.4rem] tracking-wide mb-4 text-[#e3dcc2]">
            Search Results for "{keyword}"
          </h1>
        </div>
        <div className="min-h-screen">
          {results.length === 0 ? (
            <div className="w-[90%] mx-auto bg-[#2D3738] overflow-hidden h-screen">
              <p className="text-[#e3dcc2]">No results found.</p>
            </div>
          ) : (
            <div className="w-[90%] mx-auto flex flex-wrap items-center gap-4">
              {results.map((cafe, index) => {
                let backgroundImageUrl;
                try {
                  backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
                } catch (error) {
                  backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
                }

                return (
                  <div
                    key={index}
                    className="search-card-container bg-[#1B2021] hover:cursor-pointer rounded-md w-[32%] shadow-md shadow-[#1B2021] h-full overflow-hidden text-[#E3DCC2] font-montserrat"
                  >
                    {/* Image section dengan overlay teks */}
                    <Link to={`/detailcafe/${cafe.nomor}`}>
                      <div
                        className="card-img-section relative h-[21rem] rounded-t-md bg-cover bg-center bg-no-repeat"
                        style={{
                          backgroundImage: `url(${backgroundImageUrl})`,
                        }}
                      >
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 h-[18%]">
                          <h1 className="text-[1.2rem] font-extrabold">
                            {cafe.nama_kafe}
                          </h1>
                          <h1 className="text-[0.9rem] font-normal">
                            {cafe.alamat}
                          </h1>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchCafePage;
