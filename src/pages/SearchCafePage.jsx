import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const SearchCafePage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { keyword } = useParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const navigate = useNavigate();

  // useEffect(() => {
  //   fetch(`http://127.0.0.1:5000/api/search/${keyword}`)
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
        const response = await fetch(
          `http://127.0.0.1:5000/api/search/${keyword}`
        );
        if (!response.ok) {
          throw new Error("Kafe tidak ditemukan");
        }
        const data = await response.json();
        setResults(data);
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
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
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
            <Link to="/about" className="hover:text-gray-200">
              Profile
            </Link>
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
            <Link to="/about" className="block p-2 text-[#E3DCC2]">
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
          <h1 className="font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
            Search Results for "{keyword}"
          </h1>
        </div>
        {results.length === 0 ? (
          <p className="w-[90%] mx-auto">No results found.</p>
        ) : (
          <div className="w-[90%] mx-auto flex flex-wrap items-center gap-4">
            {results.map((cafe, index) => (
              <div
                key={index}
                className="recommendation-card-container bg-[#1B2021] shadow-lg hover:cursor-pointer rounded-md w-[32%] h-full overflow-hidden text-[#E3DCC2] font-montserrat"
              >
                {/* Image section dengan overlay teks */}
                <Link to={`/detailcafe/${cafe.nomor}`}>
                  <div className="card-img-section relative h-[21rem] rounded-t-md bg-cover bg-center bg-no-repeat bg-(url-['../image/card-cafe.jpg'])">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchCafePage;
