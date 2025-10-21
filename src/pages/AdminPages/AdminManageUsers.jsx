// src/pages/admin/AdminManageUsers.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const AdminManageUsers = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState(null);

  // modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState(null);

  // pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  const navigate = useNavigate();
  const ADMIN_COOKIE_KEY = CookieKeys?.AdminToken ?? "AdminToken";

  useEffect(() => {
    // fetch admin profile if cookie exists (same pattern as welcome page)
    const adminId = CookieStorage.get(ADMIN_COOKIE_KEY);
    if (!adminId) return;
    (async () => {
      setLoadingProfile(true);
      try {
        if (!API_ENDPOINTS?.GET_ADMIN_BY_ID) {
          setLoadingProfile(false);
          return;
        }
        const resp = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ADMIN_BY_ID}${adminId}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        setAdminProfile(resp.data || null);
      } catch (err) {
        console.warn("Failed fetching admin profile:", err?.message || err);
        setAdminProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [ADMIN_COOKIE_KEY]);

  // fetch users list
  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const usersPath = (
          API_ENDPOINTS.GET_USER_BY_ID || "/api/users/"
        ).replace(/\/$/, "");
        const resp = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${usersPath}`,
          { headers: { "ngrok-skip-browser-warning": true } }
        );
        if (!mounted) return;
        if (Array.isArray(resp.data)) {
          setUsers(resp.data);
        } else {
          setUsers([]);
          if (resp.data && resp.data.error) {
            setUsersError(resp.data.error);
          }
        }
      } catch (err) {
        console.error("Failed fetching users:", err?.message || err);
        if (!mounted) return;
        setUsers([]);
        setUsersError(err?.message || "Failed to fetch users");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => {
      mounted = false;
    };
  }, []);

  // ensure currentPage valid when users length changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(users.length / usersPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  const handleLogout = () => {
    try {
      CookieStorage.remove(ADMIN_COOKIE_KEY);
      CookieStorage.remove(CookieKeys.AdminAuthToken ?? "AdminAuthToken");
    } catch (e) {
      console.warn("Error clearing cookies:", e);
    }
    navigate("/admin");
  };

  const handleDeleteUser = async (id_user) => {
    const ok = window.confirm(
      `Are you sure you want to delete user with id ${id_user}? This action cannot be undone.`
    );
    if (!ok) return;
    try {
      const delPath = (API_ENDPOINTS.GET_USER_BY_ID || "/api/users/").replace(
        /\/$/,
        ""
      );
      const resp = await axios.delete(
        `${process.env.REACT_APP_URL_SERVER}${delPath}/${id_user}`,
        { headers: { "ngrok-skip-browser-warning": true } }
      );
      console.info("Delete result:", resp.data);
    } catch (err) {
      console.error("Failed to delete user:", err?.message || err);
      alert("Failed to delete user: " + (err?.message || "unknown error"));
    }
  };

  // open modal and lock background scroll
  const openUserModal = (u) => {
    setModalUser(u);
    setModalOpen(true);
    // lock body vertical scroll while modal open
    document.body.style.overflow = "hidden";
  };

  const closeUserModal = () => {
    setModalOpen(false);
    setModalUser(null);
    document.body.style.overflow = "";
  };

  // small hidden element to avoid ESLint "assigned but never used" for adminProfile
  const hiddenAdminInfo = (
    <span className="hidden" aria-hidden>
      {adminProfile?.username ?? (loadingProfile ? "loading" : "")}
    </span>
  );

  // helper to try parse JSON strings into objects/arrays safely
  const tryParseJSON = (maybeJson) => {
    if (maybeJson === null || maybeJson === undefined) return null;
    if (typeof maybeJson === "object") return maybeJson;
    if (typeof maybeJson !== "string") return String(maybeJson);
    const trimmed = maybeJson.trim();
    if (trimmed === "") return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      // not a JSON string, return original string
      return maybeJson;
    }
  };

  // pagination helpers
  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / usersPerPage));
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const displayedUsers = users.slice(startIndex, endIndex);

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
    <div className="min-h-screen font-montserrat bg-[#1B2021] text-[#E3DCC2]">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed z-30 top-0 left-0 h-full transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
            md:translate-x-0 md:static md:w-64 w-64`}
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
                  <a
                    href="/manage_users"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] text-[#a6a867] transition-colors"
                  >
                    <FaUsers /> <span>Manage Users</span>
                  </a>
                </li>
                <li>
                  <a
                    href="/manage_cafes"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaStore /> <span>Manage Cafe</span>
                  </a>
                </li>
                <li>
                  <a
                    href="/manage_feedbacks"
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
                  >
                    <FaCommentDots /> <span>Manage Feedbacks</span>
                  </a>
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

        {/* Overlay for small screens when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-h-screen overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between p-4 border-b border-[#2d2f2f] md:border-none">
            <div className="flex items-center gap-3">
              <button
                className="text-[#E3DCC2] md:hidden p-2 rounded hover:bg-[#2d3738] focus:outline-none"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <FaBars size={18} />
              </button>
              <h2 className="text-lg font-semibold text-[#E3DCC2] sm:block md:hidden">
                Manage Users
              </h2>
            </div>
          </header>

          {/* Page content */}
          <main className="p-6 sm:p-6 px-6">
            <div className="max-w-6xl mx-auto bg-[#111314] rounded-2xl shadow-md p-6 sm:p-6 md:px-6">
              <div className="w-full rounded-2xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-[#E3DCC2]">Users</h3>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full divide-y divide-[#2d2f2f]">
                    <thead>
                      <tr className="text-left text-sm text-[#cfc9b0]">
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Username</th>
                        <th className="px-4 py-2">Min Dist</th>
                        <th className="px-4 py-2">Max Dist</th>
                        <th className="px-4 py-2">Facilities Pref</th>
                        {/* <th className="px-4 py-2">Visited Cafes</th> */}
                        {/* <th className="px-4 py-2">Favorite Menus</th> */}
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2f2f]">
                      {loadingUsers ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-4 py-6 text-center text-[#cfc9b0]"
                          >
                            Loading users...
                          </td>
                        </tr>
                      ) : usersError ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-4 py-6 text-center text-red-400"
                          >
                            {usersError}
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-4 py-6 text-center text-[#cfc9b0]"
                          >
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        displayedUsers.map((u, idx) => {
                          // defensive extraction - fields may vary
                          const id_user =
                            u.id_user ?? u.id ?? u.user_id ?? u.ID ?? null;
                          const username = u.username ?? u.user ?? "";
                          const minDist =
                            u.preferensi_jarak_minimal ??
                            u.minimum_distance_preference ??
                            "";
                          const maxDist =
                            u.preferensi_jarak_maksimal ??
                            u.maximum_distance_preference ??
                            "";
                          const facPref =
                            u.preferensi_fasilitas ??
                            u.facilities_preference ??
                            "";
                          // const visited =
                          //   u.cafe_telah_dikunjungi ??
                          //   u.cafe_telah_dikunjungi_list ??
                          //   "";
                          // const favMenus = u.menu_yang_disukai ?? "";

                          // format possibly long JSON strings for table
                          // const prettyVisited =
                          //   typeof visited === "string" && visited.length > 60
                          //     ? visited.slice(0, 60) + "..."
                          //     : JSON.stringify(visited);

                          // const prettyFavMenus =
                          //   typeof favMenus === "string" && favMenus.length > 60
                          //     ? favMenus.slice(0, 60) + "..."
                          //     : JSON.stringify(favMenus);

                          return (
                            <tr
                              key={String(id_user) + "-" + idx}
                              className="text-sm text-[#E3DCC2]"
                            >
                              <td className="px-4 py-3">{id_user ?? "—"}</td>
                              <td className="px-4 py-3">{username}</td>
                              <td className="px-4 py-3">{minDist ?? "—"}</td>
                              <td className="px-4 py-3">{maxDist ?? "—"}</td>
                              <td className="px-4 py-3">{facPref ?? "—"}</td>
                              {/* <td className="px-4 py-3">
                                <div className="max-w-xs truncate">
                                  {prettyVisited}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="max-w-xs truncate">
                                  {prettyFavMenus}
                                </div>
                              </td> */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {/* view/details opens modal */}
                                  <button
                                    title="View"
                                    onClick={() => openUserModal(u)}
                                    className="p-2 rounded hover:bg-[#2d3738] transition-colors"
                                  >
                                    <FaEye />
                                  </button>

                                  <button
                                    title="Delete user"
                                    onClick={() => handleDeleteUser(id_user)}
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

      {/* hidden admin info (prevents ESLint unused var warnings while keeping fetch logic) */}
      {hiddenAdminInfo}

      {/* Modal for viewing user (ordered fields as requested) */}
      {modalOpen && modalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
          onClick={closeUserModal}
        >
          <div
            className="w-full max-w-2xl bg-[#111314] rounded-xl shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2f2f]">
              <h4 className="text-lg font-semibold text-[#E3DCC2]">
                User Details
              </h4>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto text-sm text-[#E3DCC2]">
              {/* Render ordered fields */}
              <div className="grid grid-cols-1 gap-3">
                {/* 1. User ID */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    User ID
                  </label>
                  <input
                    readOnly
                    value={
                      modalUser.id_user ??
                      modalUser.id ??
                      modalUser.user_id ??
                      ""
                    }
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                  />
                </div>

                {/* 2. Username */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Username
                  </label>
                  <input
                    readOnly
                    value={modalUser.username ?? modalUser.user ?? ""}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                  />
                </div>

                {/* 3. Minimum Distance */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Minimum Distance
                  </label>
                  <input
                    readOnly
                    value={`${modalUser.preferensi_jarak_minimal} Km`}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                  />
                </div>

                {/* 4. Maximum Distance */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Maximum Distance
                  </label>
                  <input
                    readOnly
                    value={`${modalUser.preferensi_jarak_maksimal} Km`}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                  />
                </div>

                {/* 5. Facilities Preference */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-1">
                    Facilities Preference
                  </label>
                  <input
                    readOnly
                    value={modalUser.preferensi_fasilitas}
                    className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                  />
                </div>

                {/* 6. Visited Cafes */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-2">
                    Visited Cafes
                  </label>
                  {(() => {
                    const raw = modalUser.cafe_telah_dikunjungi;
                    const parsed = tryParseJSON(raw);
                    if (Array.isArray(parsed)) {
                      const ids = parsed.map((item) => {
                        if (item && typeof item === "object") {
                          return (
                            item.id_cafe ?? item.id ?? JSON.stringify(item)
                          );
                        }
                        return String(item);
                      });
                      return (
                        <ul className="list-disc pl-5 text-sm text-[#E3DCC2]">
                          {ids.length === 0 ? (
                            <li className="text-[#cfc9b0]">No visited cafes</li>
                          ) : (
                            ids.map((visited, i) => (
                              <li key={i}>Cafe ID : {visited}</li>
                            ))
                          )}
                        </ul>
                      );
                    } else if (typeof parsed === "string") {
                      return (
                        <textarea
                          readOnly
                          rows={4}
                          value={parsed}
                          className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                        />
                      );
                    } else if (!parsed) {
                      return (
                        <div className="text-[#cfc9b0]">No visited cafes</div>
                      );
                    } else {
                      return (
                        <pre className="whitespace-pre-wrap text-sm">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      );
                    }
                  })()}
                </div>

                {/* 7. Favorite Menus */}
                <div className="bg-[#1b2021] p-3 rounded border border-[#2d2f2f]">
                  <label className="text-xs text-[#cfc9b0] block mb-2">
                    Favorite Menus
                  </label>
                  {(() => {
                    const raw =
                      modalUser.menu_yang_disukai ??
                      modalUser.favorite_menus ??
                      modalUser.menu_liked ??
                      "";
                    const parsed = tryParseJSON(raw);
                    if (Array.isArray(parsed)) {
                      const items = parsed.map((item) => {
                        if (item && typeof item === "object") {
                          const cafe_id = item.id_cafe;
                          const name = item.nama_menu;
                          const price = item.harga;
                          return { cafe_id, name, price };
                        }
                        return {
                          cafe_id: null,
                          name: String(item),
                          price: null,
                        };
                      });
                      return items.length === 0 ? (
                        <div className="text-[#cfc9b0]">No favorite menus</div>
                      ) : (
                        <ul className="list-disc pl-5 text-sm text-[#E3DCC2]">
                          {items.map((item, i) => (
                            <li key={i}>
                              [Cafe ID : {item.cafe_id}, Name : {item.name}
                              {item.price !== null
                                ? `, Price : ${item.price}`
                                : ""}
                              ]
                            </li>
                          ))}
                        </ul>
                      );
                    } else if (typeof parsed === "string") {
                      return (
                        <textarea
                          readOnly
                          rows={4}
                          value={parsed}
                          className="w-full bg-transparent border border-[#2d2f2f] px-2 py-1 rounded text-sm text-[#E3DCC2] focus:outline-none"
                        />
                      );
                    } else if (!parsed) {
                      return (
                        <div className="text-[#cfc9b0]">No favorite menus</div>
                      );
                    } else {
                      return (
                        <pre className="whitespace-pre-wrap text-sm">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2d2f2f]">
              <button
                onClick={closeUserModal}
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

export default AdminManageUsers;
