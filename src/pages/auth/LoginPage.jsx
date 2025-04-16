import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate, Link } from "react-router-dom";
// import Cookies from "universal-cookie";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import axios from "axios";
import { API_ENDPOINTS } from "../../utils/api_endpoints";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setshowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // const api_url = process.env.REACT_APP_API_URL;
      const response = await axios.post(
        `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.LOGIN}`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = response.data;

      setSuccess("Login successful!");
      CookieStorage.set(CookieKeys.AuthToken, "Token Autentikasi");
      CookieStorage.set(CookieKeys.UserToken, data.user_id);

      if (!data.facilities_preference || !data.distance_preference) {
        setSuccess("Login successful!");
        setTimeout(() => {
          navigate("/user_preferences");
        }, 1500);
      } else {
        setSuccess("Login successful!");
        setTimeout(() => {
          navigate("/");
        }, 1500);
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || "Login failed");
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2021] flex items-center justify-center font-montserrat">
      <div className="max-w-md w-full bg-[#1B2021] shadow-xl text-[#e3dcc2] rounded px-8 py-6">
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
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
              type="text"
              id="username"
              className="w-full text-[#1B2021] px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              type={showPassword ? "text" : "password"}
              id="password"
              className="w-full text-[#1B2021] px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setshowPassword(!showPassword)}
              className="absolute right-[1rem] top-[2.5rem] text-[#1B2021] flex"
            >
              {showPassword ? <FaEye size={20} /> : <FaEyeSlash size={20} />}
            </button>
          </div>
          <button
            type="submit"
            className="w-full bg-[#E3DCC2] hover:bg-[#a6a867] text-[#1B2021] font-bold py-2 px-4 rounded transition-colors duration-300"
          >
            Login
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#a6a867] hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
