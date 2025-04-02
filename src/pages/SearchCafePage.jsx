import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const SearchCafePage = () => {
  const { keyword } = useParams();
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Ganti URL endpoint di bawah sesuai API pencarian Anda
    fetch(`http://127.0.0.1:5000/api/search/${keyword}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Search Results:", data);
        setResults(data);
      })
      .catch((error) => console.error("Error fetching search results:", error));
  }, [keyword]);

  return (
    <div className="p-4">
      <h1 className="w-[90%] mx-auto font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
        Search Results for "{keyword}"
      </h1>
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
                    <h1 className="text-[0.9rem] font-normal">{cafe.alamat}</h1>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchCafePage;
