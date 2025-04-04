import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const AllCafes = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [cafes, setCafes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const cafesPerPage = 6;
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/data")
      .then((response) => response.json())
      .then((data) => {
        console.log("Data dari API:", data);
        setCafes(data);
      })
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  // Hitung halaman
  const totalCafes = cafes.length;
  const totalPages = Math.ceil(totalCafes / cafesPerPage);
  const indexOfLastCafe = currentPage * cafesPerPage;
  const indexOfFirstCafe = indexOfLastCafe - cafesPerPage;
  const currentCafes = cafes.slice(indexOfFirstCafe, indexOfLastCafe);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

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
      <div className="px-4">
        <form
          onSubmit={handleSearch}
          className="w-[90%] mx-auto mt-4 mb-2 flex items-center font-montserrat gap-2"
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
      </div>
      {/* Search Section */}

      {/* Cafe List Section */}
      <div className="p-4">
        <div className="recommendation-section w-[90%] mx-auto flex flex-wrap items-center gap-4">
          {currentCafes.map((cafe, index) => (
            <div
              key={index}
              className="recommendation-card-container bg-[#1B2021] shadow-lg hover:cursor-pointer rounded-md w-[32%] h-full overflow-hidden text-[#E3DCC2] font-montserrat"
            >
              <Link to={`/detailcafe/${cafe.nomor}`}>
                {/* Image section dengan overlay teks */}
                <div className="card-img-section relative h-[21rem] rounded-t-md bg-cover bg-center bg-no-repeat bg-(url['../assets/image/card-cafe.jpg'])">
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 h-[18%]">
                    <h1 className="text-[1.2rem] font-extrabold">
                      {cafe.nama_kafe}
                    </h1>
                    <h1 className="text-[0.9rem] font-normal">{cafe.alamat}</h1>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Pagination Section */}
        <div className="w-[90%] mx-auto flex justify-center items-center mt-8 gap-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50 disabled:text-white hover:cursor-pointer"
          >
            Previous
          </button>
          <span className=" text-[#1B2021]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-700 text-[#E3DCC2] rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      {/* Cafe List Section */}
    </div>
  );
};

export default AllCafes;
