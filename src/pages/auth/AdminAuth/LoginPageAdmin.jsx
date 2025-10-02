// src/pages/admin/LoginPageAdmin.jsx
import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../../utils/cookies";
import axios from "axios";
import { API_ENDPOINTS } from "../../../utils/api_endpoints";

const LoginPageAdmin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.LOGIN_ADMIN}`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = response.data;
      setSuccess("Login Admin successful!");
      console.log(data, "data");
      CookieStorage.set(CookieKeys.AdminAuthToken, "AdminAuthToken");
      CookieStorage.set(CookieKeys.AdminToken, data.admin_id);
      setTimeout(() => {
        navigate(`/dashboard`);
      }, 1500);
    } catch (err) {
      setError(err.response.data.message);
      console.error(err);
      console.log(err.response.data, "data");
    }
  };
  return (
    <div className="min-h-screen bg-[#1B2021] flex items-center justify-center font-montserrat">
      <div className="max-w-md w-full bg-[#1B2021] shadow-xl text-[#e3dcc2] rounded px-8 py-6">
        <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>

        {error && (
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-[#E3DCC2] text-sm font-bold mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-[#1B2021] px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867]"
              required
            />
          </div>

          <div className="mb-6 relative">
            <label
              htmlFor="password"
              className="block text-[#E3DCC2] text-sm font-bold mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-[#1B2021] px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867]"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-[1rem] top-[2.5rem] text-[#1B2021] flex"
            >
              {showPassword ? <FaEye size={20} /> : <FaEyeSlash size={20} />}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-[#E3DCC2] hover:bg-[#a6a867] text-[#1B2021] font-bold py-2 px-4 rounded transition-colors duration-300"
          >
            Login Admin
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPageAdmin;
