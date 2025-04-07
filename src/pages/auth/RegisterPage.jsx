import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const RegisterPage = () => {
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

    // Validasi username: tidak ada spasi dan maksimum 10 huruf
    // Regex ini memastikan tidak ada spasi dan panjang antara 1 hingga 10 karakter.
    const usernameRegex = /^(?!.*\s).{1,10}$/;
    if (!usernameRegex.test(username)) {
      setError("Username tidak boleh mengandung spasi dan maksimal 10 huruf.");
      return;
    }

    // Validasi password: minimal 1 huruf kecil, 1 huruf besar, dan 1 angka
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (!passwordRegex.test(password)) {
      setError(
        "Password harus memiliki minimal 1 huruf kecil, 1 huruf besar, dan 1 angka."
      );
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Registration failed");
      } else {
        setSuccess("Registration successful! You can now login.");
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2021] flex items-center justify-center font-montserrat">
      <div className="max-w-md w-full shadow-xl rounded px-8 py-6 bg-[#1B2021] text-[#E3DCC2]">
        <h2 className="text-2xl font-bold text-center mb-6">Register</h2>
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
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-[1rem] top-[2.5rem] text-[#1B2021] flex"
            >
              {showPassword ? <FaEye size={20} /> : <FaEyeSlash size={20} />}
            </button>
          </div>
          <button
            type="submit"
            className="w-full bg-[#E3DCC2] hover:bg-[#A6A867] text-[#1B2021] font-bold py-2 px-4 rounded transition-colors duration-300"
          >
            Register
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-[#A6A867] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
