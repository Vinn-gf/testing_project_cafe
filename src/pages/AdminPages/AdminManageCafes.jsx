// src/pages/admin/AdminManageCafes.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaUpload,
  // FaTrashAlt,
  FaBars,
  FaTimes,
  FaStore,
  FaUsers,
  FaCommentDots,
  FaSignOutAlt,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import { API_ENDPOINTS } from "../../utils/api_endpoints";

const AdminManageCafes = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCafe, setSelectedCafe] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const cafesPerPage = 5;

  const navigate = useNavigate();
  const ADMIN_COOKIE_KEY = CookieKeys?.AdminToken ?? "AdminToken";

  const baseUrl = (process.env.REACT_APP_URL_SERVER || "").replace(/\/$/, "");

  useEffect(() => {
    const fetchCafes = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(
          `${baseUrl}${API_ENDPOINTS.GET_ALL_CAFES}`,
          {
            headers: { "ngrok-skip-browser-warning": true },
          }
        );
        setCafes(resp.data || []);
      } catch (err) {
        console.error("fetchCafes", err);
        setError(err?.message || "Failed to fetch cafes");
      } finally {
        setLoading(false);
      }
    };

    fetchCafes();
  }, [baseUrl]);

  const fetchCafes = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get(`${baseUrl}${API_ENDPOINTS.GET_ALL_CAFES}`, {
        headers: { "ngrok-skip-browser-warning": true },
      });
      setCafes(resp.data || []);
    } catch (err) {
      console.error("fetchCafes", err);
      setError(err?.message || "Failed to fetch cafes");
    } finally {
      setLoading(false);
    }
  };

  // When cafes list changes, ensure current page is valid
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(cafes.length / cafesPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafes]);

  const openUploadModal = (cafe) => {
    setSelectedCafe(cafe);
    setFileToUpload(null);
    setUploadProgress(0);
  };

  const closeUploadModal = () => {
    setSelectedCafe(null);
    setFileToUpload(null);
    setUploadProgress(0);
  };

  const onFileChange = (e) => {
    setFileToUpload(e.target.files?.[0] || null);
  };

  const uploadImage = async () => {
    if (!selectedCafe) return;
    if (!fileToUpload) {
      alert("Please select a file to upload");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append("image", fileToUpload);

      await axios.post(
        `${baseUrl}/api/cafe/${selectedCafe.nomor}/upload_image`,
        form,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "ngrok-skip-browser-warning": true,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percent);
            }
          },
        }
      );

      // success -> refresh list
      await fetchCafes();
      alert("Upload successful");
      closeUploadModal();
    } catch (err) {
      console.error("Upload error:", err);
      alert(
        "Upload failed: " +
          (err?.response?.data?.error || err?.message || "unknown")
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLogout = () => {
    try {
      CookieStorage.remove(ADMIN_COOKIE_KEY);
      CookieStorage.remove(CookieKeys.AuthToken ?? "DataToken");
      CookieStorage.remove(CookieKeys.UserToken ?? "UserToken");
    } catch (e) {
      console.warn("Error clearing cookies:", e);
    }
    navigate("/admin");
  };

  // Pagination helpers
  const totalCafes = cafes.length;
  const totalPages = Math.max(1, Math.ceil(totalCafes / cafesPerPage));
  const startIndex = (currentPage - 1) * cafesPerPage;
  const endIndex = startIndex + cafesPerPage;
  const displayedCafes = cafes.slice(startIndex, endIndex);

  const goToPage = (page) => {
    const p = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(p);
    // optionally scroll to top of table area
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };

  const nextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };

  return (
    <div className="overflow-hidden min-h-screen font-montserrat bg-[#1B2021] text-[#E3DCC2]">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed z-30 top-0 left-0 h-full transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 md:static md:w-64 w-64`}
        >
          <div className="h-screen bg-[#1B2021] border-r border-[#2d3738] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Toggle sidebar"
                  className="md:hidden text-[#E3DCC2] focus:outline-none"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FaTimes size={18} />
                </button>
                <Link
                  to="/dashboard"
                  className="text-xl font-bold tracking-widest"
                >
                  RecSys.
                </Link>
              </div>
            </div>

            <nav className="mt-8">
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/manage_users"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaUsers /> <span>Manage Users</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/manage_cafes"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] text-[#a6a867] transition-colors"
                  >
                    <FaStore /> <span>Manage Cafe</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/manage_feedbacks"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaCommentDots /> <span>Manage Feedbacks</span>
                  </Link>
                </li>

                <li className="mt-6 border-t border-[#2d2f2f] pt-4">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaSignOutAlt /> <span>Logout</span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        {/* Overlay for small screens */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <div className="flex-1 min-h-screen overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b border-[#2d2f2f] md:border-none">
            <div className="flex items-center gap-3">
              <button
                className="text-[#E3DCC2] md:hidden p-2 rounded hover:bg-[#2d3738]"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <FaBars size={18} />
              </button>
              <h2 className="text-lg font-semibold text-[#E3DCC2] sm:block md:hidden">
                Manage Cafes
              </h2>
            </div>
          </header>

          <main className="p-6 sm:p-6 md:px-6">
            <div className="max-w-6xl mx-auto bg-[#111314] rounded-2xl p-6 shadow-md sm:p-6 md:px-6">
              <div className="w-full rounded-2xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-[#E3DCC2]">Cafes</h3>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full divide-y divide-[#2d2f2f]">
                    <thead>
                      <tr className="text-left text-sm text-[#cfc9b0]">
                        <th className="px-4 py-2">Nomor</th>
                        <th className="px-4 py-2">Gambar</th>
                        <th className="px-4 py-2">Nama Kafe</th>
                        <th className="px-4 py-2">Alamat</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2f2f]">
                      {loading ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-6 text-center text-[#cfc9b0]"
                          >
                            Loading cafes...
                          </td>
                        </tr>
                      ) : error ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-6 text-center text-red-400"
                          >
                            {error}
                          </td>
                        </tr>
                      ) : cafes.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-6 text-center text-[#cfc9b0]"
                          >
                            No cafes found.
                          </td>
                        </tr>
                      ) : (
                        displayedCafes.map((c, idx) => {
                          const imageUrl =
                            c.gambar_kafe &&
                            typeof c.gambar_kafe === "string" &&
                            c.gambar_kafe.startsWith("/")
                              ? `${baseUrl}${c.gambar_kafe}`
                              : null;
                          return (
                            <tr
                              key={String(c.nomor) + "-" + idx}
                              className="text-sm text-[#E3DCC2]"
                            >
                              <td className="px-4 py-3">{c.nomor}</td>
                              <td className="px-4 py-3">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={c.nama_kafe}
                                    className="h-16 w-28 object-cover rounded"
                                  />
                                ) : (
                                  <div className="h-16 w-28 bg-[#1b2021] flex items-center justify-center rounded text-sm text-[#cfc9b0]">
                                    No Image
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">{c.nama_kafe}</td>
                              <td className="px-4 py-3">{c.alamat}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openUploadModal(c)}
                                    className="flex items-center gap-2 px-3 py-1 rounded bg-[#1B2021] hover:bg-[#2d3738] border border-[#2d2f2f]"
                                  >
                                    <FaUpload /> Upload Image
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded ${
                        currentPage === 1
                          ? "opacity-50 cursor-not-allowed"
                          : "bg-[#1B2021] hover:bg-[#2d3738]"
                      } text-[#E3DCC2] border border-[#2d2f2f]`}
                      aria-label="Previous page"
                    >
                      Previous
                    </button>

                    {/* page numbers (show up to 7 numbers with truncation if many) */}
                    <div className="hidden sm:flex items-center gap-1">
                      {/*
                      Simple pagination rendering:
                      - If totalPages <= 7, show all
                      - Else show first, maybe ..., few around current, ..., last
                    */}
                      {totalPages <= 7 ? (
                        Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (p) => (
                            <button
                              key={p}
                              onClick={() => goToPage(p)}
                              className={`px-2 py-1 rounded ${
                                p === currentPage
                                  ? "bg-[#2d3738] text-white"
                                  : "bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2]"
                              } border border-[#2d2f2f]`}
                            >
                              {p}
                            </button>
                          )
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => goToPage(1)}
                            className={`px-2 py-1 rounded ${
                              currentPage === 1
                                ? "bg-[#2d3738] text-white"
                                : "bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2]"
                            } border border-[#2d2f2f]`}
                          >
                            1
                          </button>

                          {currentPage > 4 && <span className="px-2">...</span>}

                          {Array.from({ length: 3 }, (_, i) => {
                            // center on current page
                            const midStart = Math.max(
                              2,
                              Math.min(currentPage - 1, totalPages - 3)
                            );
                            return midStart + i;
                          })
                            .filter((p) => p > 1 && p < totalPages)
                            .map((p) => (
                              <button
                                key={p}
                                onClick={() => goToPage(p)}
                                className={`px-2 py-1 rounded ${
                                  p === currentPage
                                    ? "bg-[#2d3738] text-white"
                                    : "bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2]"
                                } border border-[#2d2f2f]`}
                              >
                                {p}
                              </button>
                            ))}

                          {currentPage < totalPages - 3 && (
                            <span className="px-2">...</span>
                          )}

                          <button
                            onClick={() => goToPage(totalPages)}
                            className={`px-2 py-1 rounded ${
                              currentPage === totalPages
                                ? "bg-[#2d3738] text-white"
                                : "bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2]"
                            } border border-[#2d2f2f]`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded ${
                        currentPage === totalPages
                          ? "opacity-50 cursor-not-allowed"
                          : "bg-[#1B2021] hover:bg-[#2d3738]"
                      } text-[#E3DCC2] border border-[#2d2f2f]`}
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Upload Modal */}
      {selectedCafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-lg bg-[#111314] rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2f2f]">
              <h4 className="text-lg font-semibold text-[#E3DCC2]">
                Upload Image for {selectedCafe.nama_kafe}
              </h4>
              <button
                onClick={closeUploadModal}
                className="text-[#cfc9b0] px-2 py-1 rounded hover:bg-[#2d3738]"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 text-sm text-[#cfc9b0]">
                Choose an image file (jpg, jpeg, png, gif, webp). Max ~8MB.
              </div>

              <input type="file" accept="image/*" onChange={onFileChange} />

              {uploading && (
                <div className="mt-3">
                  <div className="bg-[#1B2021] rounded h-3 overflow-hidden">
                    <div
                      style={{ width: `${uploadProgress}%` }}
                      className="h-3 bg-[#4caf50]"
                    />
                  </div>
                  <div className="text-sm text-[#cfc9b0] mt-1">
                    {uploadProgress}%
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={closeUploadModal}
                  className="px-3 py-1 rounded bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2] border border-[#2d2f2f]"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadImage}
                  disabled={uploading}
                  className="px-3 py-1 rounded bg-[#2d3738] hover:bg-[#3b4444] text-[#E3DCC2]"
                >
                  Upload
                </button>
              </div>
            </div>

            <div className="p-3 text-right text-xs text-[#cfc9b0] border-t border-[#2d2f2f]">
              Uploaded image will replace previous image for this cafe.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManageCafes;
