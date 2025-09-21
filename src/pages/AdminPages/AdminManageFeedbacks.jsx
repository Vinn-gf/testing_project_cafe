// src/pages/admin/AdminManageFeedbacks.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaUsers,
  FaStore,
  FaCommentDots,
  FaSignOutAlt,
  FaTrashAlt,
  FaEye,
} from "react-icons/fa";
import axios from "axios";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import { API_ENDPOINTS } from "../../utils/api_endpoints";

const AdminManageFeedbacks = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const feedbacksPerPage = 5;

  const navigate = useNavigate();
  const location = useLocation();
  const ADMIN_COOKIE_KEY = CookieKeys?.AdminToken ?? "AdminToken";

  // Build base path for feedback GET (and DELETE) with fallback attempt
  const fbEndpointCandidate = (
    API_ENDPOINTS.GET_FEEDBACK || "/api/feedback"
  ).replace(/\/$/, "");
  const altFbEndpoint =
    fbEndpointCandidate === "/api/feedback"
      ? "/api/feedbacks"
      : "/api/feedback";

  const fetchFeedbacks = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try primary endpoint
      const resp = await axios.get(
        `${process.env.REACT_APP_URL_SERVER}${fbEndpointCandidate}`,
        {
          headers: { "ngrok-skip-browser-warning": true },
        }
      );
      const data = resp?.data;
      if (Array.isArray(data)) {
        setFeedbacks(data);
        setLoading(false);
        return;
      }
      if (data && typeof data === "object") {
        const arrCandidate = data.feedbacks || data.data || null;
        if (Array.isArray(arrCandidate)) {
          setFeedbacks(arrCandidate);
          setLoading(false);
          return;
        }
      }
      // fallback to alternate endpoint
      const altResp = await axios.get(
        `${process.env.REACT_APP_URL_SERVER}${altFbEndpoint}`,
        {
          headers: { "ngrok-skip-browser-warning": true },
        }
      );
      const altData = altResp?.data;
      setFeedbacks(Array.isArray(altData) ? altData : []);
    } catch (err) {
      // try alternate endpoint if first failed
      try {
        const altResp = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${altFbEndpoint}`,
          {
            headers: { "ngrok-skip-browser-warning": true },
          }
        );
        const altData = altResp?.data;
        setFeedbacks(Array.isArray(altData) ? altData : []);
      } catch (err2) {
        console.error("Failed to fetch feedbacks:", err2 || err);
        setError(
          (err2 && err2.message) ||
            (err && err.message) ||
            "Failed to fetch feedbacks"
        );
        setFeedbacks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
    // close sidebar on route change
    setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // keep currentPage valid whenever feedbacks length changes
  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(feedbacks.length / feedbacksPerPage)
    );
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [feedbacks, currentPage]);

  const handleDeleteFeedback = async (id) => {
    if (!id) return;
    const ok = window.confirm(
      `Delete feedback ${id}? This action cannot be undone.`
    );
    if (!ok) return;

    setLoading(true);
    setError(null);

    const tryDelete = async (basePath) =>
      axios.delete(`${process.env.REACT_APP_URL_SERVER}${basePath}/${id}`, {
        headers: { "ngrok-skip-browser-warning": true },
      });

    try {
      await tryDelete(fbEndpointCandidate);
    } catch (e1) {
      try {
        await tryDelete(altFbEndpoint);
      } catch (e2) {
        console.error("Failed to delete feedback:", e2 || e1);
        alert(
          "Failed to delete feedback: " +
            ((e2 && e2.message) || (e1 && e1.message) || "unknown")
        );
        setLoading(false);
        return;
      }
    } finally {
      // refresh list
      await fetchFeedbacks();
    }
  };

  const openModal = (fb) => {
    setModalFeedback(fb);
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalFeedback(null);
    document.body.style.overflow = "";
  };

  const handleLogout = () => {
    try {
      CookieStorage.remove(ADMIN_COOKIE_KEY);
      CookieStorage.remove(CookieKeys.AuthToken ?? "DataToken");
      CookieStorage.remove(CookieKeys.UserToken ?? "UserToken");
    } catch (e) {
      console.warn("logout cleanup error", e);
    }
    navigate("/admin");
  };

  const handleTableWheel = (e) => {
    const container = e.currentTarget;
    if (Math.abs(e.deltaX) > 0) return;
    if (
      Math.abs(e.deltaY) > 0 &&
      container.scrollWidth > container.clientWidth
    ) {
      container.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  // pagination helpers
  const totalFeedbacks = feedbacks.length;
  const totalPages = Math.max(1, Math.ceil(totalFeedbacks / feedbacksPerPage));
  const startIndex = (currentPage - 1) * feedbacksPerPage;
  const displayedFeedbacks = feedbacks.slice(
    startIndex,
    startIndex + feedbacksPerPage
  );

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

  return (
    <div className="min-h-screen font-montserrat bg-[#1B2021] text-[#E3DCC2] overflow-x-hidden">
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
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaStore /> <span>Manage Cafe</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/manage_feedbacks"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] text-[#a6a867] transition-colors"
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
                className="text-[#E3DCC2] md:hidden p-2 rounded hover:bg-[#2d3738] focus:outline-none"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <FaBars size={18} />
              </button>
              <h2 className="text-lg font-semibold text-[#E3DCC2] block sm:block md:hidden">
                Manage Feedbacks
              </h2>
            </div>
          </header>

          <main className="p-6 sm:p-6 md:px-6">
            <div className="bg-[#111314] rounded-2xl p-6 shadow-mdp-6 sm:p-6 md:px-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-[#E3DCC2]">Feedbacks</h3>
                <div></div>
              </div>

              <div className="overflow-hidden rounded-md border border-[#2d2f2f]">
                <div
                  className="w-full overflow-x-auto overflow-y-auto"
                  style={{ maxHeight: "62vh" }}
                  onWheel={handleTableWheel}
                  tabIndex={0}
                >
                  <div
                    style={{ minWidth: 1000 }}
                    className="inline-block w-full align-top"
                  >
                    <table className="w-full divide-y divide-[#2d2f2f]">
                      <thead>
                        <tr className="text-left text-sm text-[#cfc9b0]">
                          <th className="px-4 py-3">Feedback ID</th>
                          <th className="px-4 py-3">User ID</th>
                          <th className="px-4 py-3">Feedback</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#2d2f2f]">
                        {loading ? (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-4 py-6 text-center text-[#cfc9b0]"
                            >
                              Loading feedbacks...
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
                        ) : feedbacks.length === 0 ? (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-4 py-6 text-center text-[#cfc9b0]"
                            >
                              No feedbacks found.
                            </td>
                          </tr>
                        ) : (
                          displayedFeedbacks.map((f, i) => {
                            const id_fb =
                              f.id_feedback ?? f.id ?? f.id_fb ?? f.ID ?? null;
                            const id_user =
                              f.id_user ?? f.user_id ?? f.idUser ?? null;
                            const txt =
                              f.user_feedback ?? f.feedback ?? f.body ?? "";

                            return (
                              <tr
                                key={String(id_fb) + "-" + i}
                                className="text-sm text-[#E3DCC2]"
                              >
                                <td className="px-4 py-3">{id_fb ?? "—"}</td>
                                <td className="px-4 py-3">{id_user ?? "—"}</td>
                                <td className="px-4 py-3">
                                  <div className="max-w-xs truncate">
                                    {String(txt)}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      title="View"
                                      onClick={() => openModal(f)}
                                      className="p-2 rounded hover:bg-[#2d3738] transition-colors"
                                    >
                                      <FaEye />
                                    </button>
                                    <button
                                      title="Delete"
                                      onClick={() =>
                                        handleDeleteFeedback(id_fb)
                                      }
                                      className="p-2 rounded hover:bg-red-700 transition-colors text-red-400"
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
                </div>
              </div>

              {/* Pagination controls */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-[#cfc9b0]">
                  Showing <strong>{displayedFeedbacks.length}</strong> of{" "}
                  <strong>{totalFeedbacks}</strong> feedbacks.
                </div>

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
          </main>
        </div>
      </div>

      {/* Modal for feedback details */}
      {modalOpen && modalFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl bg-[#111314] rounded-xl shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2f2f]">
              <h4 className="text-lg font-semibold text-[#E3DCC2]">
                Feedback Details
              </h4>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto text-sm text-[#E3DCC2]">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Feedback ID
                  </label>
                  <input
                    readOnly
                    value={modalFeedback.id_feedback ?? modalFeedback.id ?? ""}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2]"
                  />
                </div>

                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    User ID
                  </label>
                  <input
                    readOnly
                    value={modalFeedback.id_user ?? modalFeedback.user_id ?? ""}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2]"
                  />
                </div>

                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Feedback
                  </label>
                  <textarea
                    readOnly
                    rows={6}
                    value={
                      modalFeedback.user_feedback ??
                      modalFeedback.feedback ??
                      ""
                    }
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2d2f2f]">
              <button
                onClick={closeModal}
                className="px-3 py-1 rounded bg-[#1B2021] hover:bg-[#2d3738] text-[#E3DCC2] border border-[#2d2f2f]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManageFeedbacks;
