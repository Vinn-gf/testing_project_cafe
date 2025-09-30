// src/pages/admin/AdminManageCafes.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaUpload,
  FaBars,
  FaTimes,
  FaStore,
  FaUsers,
  FaCommentDots,
  FaSignOutAlt,
  FaEye,
  FaPlus,
  FaTrashAlt,
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

  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCafe, setViewCafe] = useState(null);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [newCafe, setNewCafe] = useState({
    nomor: "",
    nama_kafe: "",
    alamat: "",
    fasilitas: "",
    rating: "",
    latitude: "",
    longitude: "",
    gambar_kafe: "",
  });
  const [creating, setCreating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const cafesPerPage = 5;

  const navigate = useNavigate();
  // const ADMIN_COOKIE_KEY = CookieKeys?.AdminToken ?? "AdminToken";

  const baseUrl = (process.env.REACT_APP_URL_SERVER || "").replace(/\/$/, "");

  useEffect(() => {
    fetchCafes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const fetchCafes = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get(`${baseUrl}${API_ENDPOINTS.GET_ALL_CAFES}`, {
        headers: { "ngrok-skip-browser-warning": true },
      });
      // ensure we set an array
      setCafes(Array.isArray(resp.data) ? resp.data : resp.data || []);
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

      // upload endpoint uses /api/cafe/{nomor}/upload_image — keep this
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
      // CookieStorage.remove(ADMIN_COOKIE_KEY);
      CookieStorage.remove(CookieKeys.AuthToken ?? "DataToken");
      // CookieStorage.remove(CookieKeys.UserToken ?? "UserToken");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };

  const nextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };

  // --- VIEW modal helpers ---
  const openViewModal = async (cafe) => {
    // if GET_DETAIL_CAFE available, try fetch fresh detail
    try {
      if (API_ENDPOINTS.GET_DETAIL_CAFE) {
        // endpoint may be like "/api/cafe/" and expects id appended
        let detailUrl = `${baseUrl}${API_ENDPOINTS.GET_DETAIL_CAFE}`;
        // if placeholder :id used
        if (API_ENDPOINTS.GET_DETAIL_CAFE.includes(":id")) {
          detailUrl = `${baseUrl}${API_ENDPOINTS.GET_DETAIL_CAFE.replace(
            ":id",
            cafe.nomor ?? cafe.id ?? ""
          )}`;
        } else {
          // if endpoint ends with / then append id, otherwise append id directly
          if (!detailUrl.endsWith("/")) detailUrl = detailUrl + "/";
          detailUrl = detailUrl + (cafe.nomor ?? cafe.id ?? "");
        }
        const resp = await axios.get(detailUrl, {
          headers: { "ngrok-skip-browser-warning": true },
        });
        setViewCafe(resp.data || cafe);
        setViewOpen(true);
        return;
      }
    } catch (err) {
      // ignore and fall back to provided row object
      console.warn("Failed to fetch detail, using row object", err);
    }
    setViewCafe(cafe);
    setViewOpen(true);
  };
  const closeViewModal = () => {
    setViewCafe(null);
    setViewOpen(false);
  };

  // --- DELETE cafe ---
  const deleteCafe = async (nomor) => {
    if (!window.confirm("Are you sure you want to delete this cafe?")) return;
    try {
      let delUrl = `${baseUrl}/api/cafe/${nomor}`;

      if (API_ENDPOINTS.DELETE_CAFE) {
        const ep = API_ENDPOINTS.DELETE_CAFE;
        // If endpoint has placeholder :id -> replace
        if (ep.includes(":id")) {
          delUrl = `${baseUrl}${ep.replace(":id", String(nomor))}`;
        } else {
          // if endpoint already ends with slash or looks like '/api/cafe/' append nomor
          if (ep.endsWith("/")) {
            delUrl = `${baseUrl}${ep}${nomor}`;
          } else {
            // if ep equals '/api/cafe' or '/api/cafe/' handle both
            // if ep seems to be a full path and does not include id, append nomor
            delUrl = `${baseUrl}${ep}${ep.endsWith("/") ? "" : "/"}${nomor}`;
          }
        }
      }

      await axios.delete(delUrl, {
        headers: { "ngrok-skip-browser-warning": true },
      });
      alert("Cafe deleted");
      await fetchCafes();
      // if view modal open for same cafe, close it
      if (viewCafe && String(viewCafe.nomor) === String(nomor))
        closeViewModal();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Delete failed: " + (err?.response?.data?.error || err?.message));
    }
  };

  // --- CREATE cafe ---
  const openAddModal = () => {
    setNewCafe({
      nomor: "",
      nama_kafe: "",
      alamat: "",
      fasilitas: "",
      rating: "",
      latitude: "",
      longitude: "",
      gambar_kafe: "",
    });
    setAddOpen(true);
  };

  const closeAddModal = () => {
    setNewCafe({
      nomor: "",
      nama_kafe: "",
      alamat: "",
      fasilitas: "",
      rating: "",
      latitude: "",
      longitude: "",
      gambar_kafe: "",
    });
    setAddOpen(false);
  };

  const createCafe = async () => {
    // basic validation
    if (!newCafe.nama_kafe || !newCafe.alamat) {
      alert("Nama kafe dan alamat wajib diisi");
      return;
    }
    setCreating(true);
    try {
      // use API_ENDPOINTS.CREATE_CAFE if present, else fallback to /api/cafe
      let createUrl = `${baseUrl}/api/cafe`;
      if (API_ENDPOINTS.CREATE_CAFE) {
        // ensure leading slash handled
        createUrl = `${baseUrl}${API_ENDPOINTS.CREATE_CAFE}`;
      } else if (API_ENDPOINTS.GET_ALL_CAFES) {
        // sometimes create is same as GET_ALL_CAFES (POST to same route)
        createUrl = `${baseUrl}${API_ENDPOINTS.GET_ALL_CAFES}`;
      }

      // Build payload - backend may expect different fields; adapt as necessary
      const payload = {
        nomor: newCafe.nomor || undefined,
        nama_kafe: newCafe.nama_kafe,
        alamat: newCafe.alamat,
        fasilitas: newCafe.fasilitas,
        rating:
          newCafe.rating !== "" && newCafe.rating !== null
            ? Number(newCafe.rating)
            : undefined,
        latitude:
          newCafe.latitude !== "" && newCafe.latitude !== null
            ? Number(newCafe.latitude)
            : undefined,
        longitude:
          newCafe.longitude !== "" && newCafe.longitude !== null
            ? Number(newCafe.longitude)
            : undefined,
        gambar_kafe: newCafe.gambar_kafe || undefined,
      };

      // remove undefined props
      Object.keys(payload).forEach((k) =>
        payload[k] === undefined ? delete payload[k] : null
      );

      await axios.post(createUrl, payload, {
        headers: { "ngrok-skip-browser-warning": true },
      });
      alert("Cafe created");
      await fetchCafes();
      closeAddModal();
    } catch (err) {
      console.error("Create error:", err);
      alert("Create failed: " + (err?.response?.data?.error || err?.message));
    } finally {
      setCreating(false);
    }
  };

  // helper for image URL
  const computeImageUrl = (cafeObj) => {
    if (!cafeObj) return null;
    const img = cafeObj.gambar_kafe;
    if (!img) return null;
    if (typeof img === "string" && img.startsWith("/")) {
      return `${baseUrl}${img}`;
    }
    return img;
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
                  <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-3 py-1 rounded bg-[#2a6b2a] hover:bg-[#2f7a2f] text-white"
                    title="Add Cafe"
                  >
                    <FaPlus /> Add Cafe
                  </button>
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
                          const imageUrl = computeImageUrl(c);
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

                                  <button
                                    title="View details"
                                    onClick={() => openViewModal(c)}
                                    className="px-2 py-1 rounded bg-[#1B2021] hover:bg-[#2d3738] border border-[#2d2f2f]"
                                  >
                                    <FaEye />
                                  </button>

                                  <button
                                    onClick={() => deleteCafe(c.nomor)}
                                    title="Delete cafe"
                                    className="px-2 py-1 rounded bg-[#7a1b1b] hover:bg-[#8f1f1f] text-white"
                                  >
                                    <FaTrashAlt />
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

                    <div className="hidden sm:flex items-center gap-1">
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
          </div>
        </div>
      )}

      {/* VIEW Modal (detail form read-only) */}
      {viewOpen && viewCafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-2xl bg-[#111314] rounded-xl shadow-lg overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2f2f]">
              <h4 className="text-lg font-semibold text-[#E3DCC2]">
                {viewCafe.nama_kafe || viewCafe.nomor}
              </h4>
              <div className="flex items-center justify-between">
                <button
                  onClick={closeViewModal}
                  className="text-[#cfc9b0] px-2 py-1 rounded hover:bg-[#2d3738]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#cfc9b0]">
              <div>
                <label className="block text-xs text-[#cfc9b0]">Nomor</label>
                <input
                  readOnly
                  value={viewCafe.nomor ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Nama Kafe
                </label>
                <input
                  readOnly
                  value={viewCafe.nama_kafe ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-[#cfc9b0]">Alamat</label>
                <textarea
                  readOnly
                  value={viewCafe.alamat ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Fasilitas
                </label>
                <input
                  readOnly
                  value={viewCafe.fasilitas ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">Rating</label>
                <input
                  readOnly
                  value={viewCafe.rating ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">Latitude</label>
                <input
                  readOnly
                  value={viewCafe.latitude ?? viewCafe.lat ?? ""}
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Longitude
                </label>
                <input
                  readOnly
                  value={
                    viewCafe.longitude ?? viewCafe.lon ?? viewCafe.lng ?? ""
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-[#cfc9b0]">Gambar</label>
                {computeImageUrl(viewCafe) ? (
                  <img
                    src={computeImageUrl(viewCafe)}
                    alt={viewCafe.nama_kafe}
                    className="w-full max-h-60 object-cover rounded"
                  />
                ) : (
                  <div className="h-40 bg-[#1b2021] flex items-center justify-center rounded text-sm text-[#cfc9b0]">
                    No Image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-2xl bg-[#111314] rounded-xl shadow-lg overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2f2f]">
              <h4 className="text-lg font-semibold text-[#E3DCC2]">
                Add New Cafe
              </h4>
              <button
                onClick={closeAddModal}
                className="text-[#cfc9b0] px-2 py-1 rounded hover:bg-[#2d3738]"
              >
                Close
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#cfc9b0]">
              <div>
                <label className="block text-xs text-[#cfc9b0]">Nomor</label>
                <input
                  value={newCafe.nomor}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, nomor: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Nama Kafe
                </label>
                <input
                  value={newCafe.nama_kafe}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, nama_kafe: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-[#cfc9b0]">Alamat</label>
                <textarea
                  value={newCafe.alamat}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, alamat: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Fasilitas
                </label>
                <input
                  value={newCafe.fasilitas}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, fasilitas: e.target.value }))
                  }
                  className="w-full bg-[#1B2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">Rating</label>
                <input
                  value={newCafe.rating}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, rating: e.target.value }))
                  }
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">Latitude</label>
                <input
                  value={newCafe.latitude}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, latitude: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#cfc9b0]">
                  Longitude
                </label>
                <input
                  value={newCafe.longitude}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, longitude: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-[#cfc9b0]">
                  Gambar (URL/path)
                </label>
                <input
                  value={newCafe.gambar_kafe}
                  onChange={(e) =>
                    setNewCafe((p) => ({ ...p, gambar_kafe: e.target.value }))
                  }
                  className="w-full bg-[#1b2021] p-2 rounded text-[#E3DCC2]"
                />
                <div className="text-xs text-[#8f8f88] mt-1">
                  Jika Anda ingin upload file, setelah membuat data kafe,
                  gunakan tombol "Upload Image" pada baris kafe.
                </div>
              </div>
            </div>

            <div className="p-4 flex justify-end gap-2 border-t border-[#2d2f2f]">
              <button
                onClick={closeAddModal}
                className="px-3 py-1 rounded bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2] border border-[#2d2f2f]"
              >
                Cancel
              </button>
              <button
                onClick={createCafe}
                disabled={creating}
                className="px-3 py-1 rounded bg-[#2d3738] hover:bg-[#3b4444] text-[#E3DCC2]"
              >
                {creating ? "Creating..." : "Create Cafe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManageCafes;
