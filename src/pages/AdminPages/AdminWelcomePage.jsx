// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaUsers,
  FaStore,
  FaCommentDots,
  FaSignOutAlt,
} from "react-icons/fa";
import axios from "axios";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import { API_ENDPOINTS } from "../../utils/api_endpoints";

const AdminWelcomePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // New states for totals
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalCafes, setTotalCafes] = useState(null);
  const [totalFeedbacks, setTotalFeedbacks] = useState(null);

  const navigate = useNavigate();

  const ADMIN_COOKIE_KEY = CookieKeys?.AdminToken ?? "AdminToken";

  useEffect(() => {
    // try fetch admin profile if cookie admin id exists
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
        // don't block UI on error
        console.warn("Failed fetching admin profile:", err?.message || err);
        setAdminProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [ADMIN_COOKIE_KEY]);

  // fetch totals for users, cafes, feedbacks
  useEffect(() => {
    let mounted = true;

    const fetchTotals = async () => {
      try {
        axios
          .get(
            `${
              process.env.REACT_APP_URL_SERVER
            }${API_ENDPOINTS.GET_ALL_CAFES.replace("/data", "/users")}`
          ) // fallback if path mismatch
          .catch(() =>
            axios.get(
              `${
                process.env.REACT_APP_URL_SERVER
              }${API_ENDPOINTS.GET_USER_BY_ID.replace(
                "/api/users/",
                "/api/users"
              )}`
            )
          ); // noop fallback
        // Better to call exact endpoints explicitly:
        const fetchUsers = axios
          .get(
            `${
              process.env.REACT_APP_URL_SERVER
            }${API_ENDPOINTS.GET_USER_BY_ID.slice(0, -1)}`,
            {
              // GET_USER_BY_ID is "/api/users/" -> remove trailing slash
              headers: { "ngrok-skip-browser-warning": true },
            }
          )
          .catch(() => ({ data: [] }));

        const fetchCafes = axios
          .get(
            `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_ALL_CAFES}`,
            {
              headers: { "ngrok-skip-browser-warning": true },
            }
          )
          .catch(() => ({ data: [] }));

        const getFeedback = axios
          .get(
            `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_FEEDBACK}`,
            {
              headers: { "ngrok-skip-browser-warning": true },
            }
          )
          .catch(() => ({ data: [] }));

        // Use Promise.all with the explicit requests
        const [usersResp, cafesResp, feedbackResp] = await Promise.all([
          fetchUsers,
          fetchCafes,
          getFeedback,
        ]);

        if (!mounted) return;

        // usersResp.data should be an array of users; if it's an object with error -> set 0
        const usersData = usersResp?.data;
        if (Array.isArray(usersData)) {
          setTotalUsers(usersData.length);
        } else if (
          usersData &&
          typeof usersData === "object" &&
          usersData.error
        ) {
          setTotalUsers(0);
        } else {
          // fallback: try to detect if it's an object mapping
          setTotalUsers(Array.isArray(usersData) ? usersData.length : 0);
        }

        const cafesData = cafesResp?.data;
        if (Array.isArray(cafesData)) {
          setTotalCafes(cafesData.length);
        } else if (
          cafesData &&
          typeof cafesData === "object" &&
          cafesData.error
        ) {
          setTotalCafes(0);
        } else {
          setTotalCafes(Array.isArray(cafesData) ? cafesData.length : 0);
        }

        const feedbackData = feedbackResp?.data;
        if (Array.isArray(feedbackData)) {
          setTotalFeedbacks(feedbackData.length);
        } else if (
          feedbackData &&
          typeof feedbackData === "object" &&
          feedbackData.error
        ) {
          setTotalFeedbacks(0);
        } else {
          setTotalFeedbacks(
            Array.isArray(feedbackData) ? feedbackData.length : 0
          );
        }
      } catch (err) {
        console.warn("Failed to fetch totals:", err?.message || err);
        if (!mounted) return;
        setTotalUsers(0);
        setTotalCafes(0);
        setTotalFeedbacks(0);
      }
    };

    fetchTotals();

    return () => {
      mounted = false;
    };
  }, []); // run once on mount

  const handleLogout = () => {
    // remove admin cookie(s) and navigate to admin login or home
    try {
      CookieStorage.remove(ADMIN_COOKIE_KEY);
      // also remove general user tokens if desired (safe-guard)
      CookieStorage.remove(CookieKeys.AuthToken ?? "DataToken");
      CookieStorage.remove(CookieKeys.UserToken ?? "UserToken");
    } catch (e) {
      console.warn("Error clearing cookies:", e);
    }
    navigate("/admin");
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
                  className="text-xl font-bold tracking-widest text-[#a6a867]"
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
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2d3738] transition-colors"
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
        <div className="flex-1 min-h-screen">
          {/* Top bar */}
          <header className="flex items-center justify-between p-4 border-b border-[#2d2f2f] md:border-none lg:border-none">
            <div className="flex items-center gap-3">
              <button
                className="text-[#E3DCC2] md:hidden p-2 rounded hover:bg-[#2d3738] focus:outline-none"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <FaBars size={18} />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="p-6">
            <div className="max-w-5xl mx-auto">
              {/* Welcome card */}
              <div className="bg-[#111314] rounded-2xl p-6 shadow-md">
                <h1 className="text-3xl font-bold text-[#E3DCC2]">
                  Welcome{" "}
                  {loadingProfile
                    ? "Loading profile..."
                    : adminProfile?.username
                    ? `${adminProfile.username}`
                    : "Admin"}
                </h1>
                <p className="mt-2 text-[#cfc9b0]"></p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#1b2021] p-4 rounded-lg border border-[#2d2f2f]">
                    <p className="text-sm text-[#cfc9b0]">Total Users</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {totalUsers === null ? "—" : totalUsers}
                    </p>
                  </div>

                  <div className="bg-[#1b2021] p-4 rounded-lg border border-[#2d2f2f]">
                    <p className="text-sm text-[#cfc9b0]">Total Cafes</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {totalCafes === null ? "—" : totalCafes}
                    </p>
                  </div>

                  <div className="bg-[#1b2021] p-4 rounded-lg border border-[#2d2f2f]">
                    <p className="text-sm text-[#cfc9b0]">Total Feedbacks</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {totalFeedbacks === null ? "—" : totalFeedbacks}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminWelcomePage;
