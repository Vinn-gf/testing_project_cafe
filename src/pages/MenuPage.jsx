import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../utils/api_endpoints";
import { useParams } from "react-router-dom";
import { ColorRing } from "react-loader-spinner";

const MenuPage = () => {
  const { id: cafeId } = useParams();
  const [menus, setMenus] = useState([]); // langsung pakai menus
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  //   const [Test, setTest] = useState(false);
  const itemsPerPage = 9;

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_MENU_BY_ID}${cafeId}`,
          {
            headers: {
              "ngrok-skip-browser-warning": true,
            },
          }
        );
        setMenus(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [cafeId]);

  useEffect(() => {
    console.log(menus.length, "length");
    console.log(menus, "menu");
  }, [menus]);

  const totalPages = Math.ceil(menus.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentMenus = menus.slice(startIdx, startIdx + itemsPerPage);

  const handlePrev = () => currentPage > 1 && setCurrentPage((p) => p - 1);
  const handleNext = () =>
    currentPage < totalPages && setCurrentPage((p) => p + 1);

  if (loading || menus.length < 0) {
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
    <div className="bg-[#2D3738] min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[#E3DCC2] mb-4 font-montserrat">
          Menu Cafe #{cafeId}
        </h1>

        {/* Makanan */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#E3DCC2] mb-2 font-montserrat">
            Makanan
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {currentMenus.map((item) => (
              <div
                key={item.id_cafe}
                className="bg-[#1B2021] p-4 rounded-lg shadow-md flex flex-col"
              >
                <h3 className="font-bold text-lg text-[#E3DCC2]">
                  {item.nama_menu}
                </h3>
                <p className="mt-2 text-[#E3DCC2]">Harga: {item.harga}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Minuman */}
        {/* <section className="mb-8">
          <h2 className="text-xl font-semibold text-[#E3DCC2] mb-2 font-montserrat">
            Minuman
          </h2>
          {minuman.length > 0 ? (
            <p className="text-[#e3dcc2]">Tidak ada menu minuman.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {minuman.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#1B2021] p-4 rounded-lg shadow-md flex flex-col"
                >
                  <h3 className="font-bold text-lg text-[#E3DCC2]">
                    {item.nama_menu}
                  </h3>
                  <p className="mt-2 text-[#E3DCC2]">Harga: {item.harga}</p>
                </div>
              ))}
            </div>
          )}
        </section> */}

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
