import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import axios from "axios";

const UserPreferences = () => {
  const [minimumDistance, setMinimumDistance] = useState("");
  const [maximumDistance, setMaximumDistance] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const facilityOptions = [
    "Free Wi-Fi",
    "Toilet",
    "AC",
    "Buku",
    "Carwash",
    "Billiard",
    "Kucing",
    "Live Music",
  ];

  const handleFacilityChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedFacilities((prev) => [...prev, value]);
    } else {
      setSelectedFacilities((prev) =>
        prev.filter((facility) => facility !== value)
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Validasi: cek jumlah checkbox yang dipilih minimal 2
    if (selectedFacilities.length !== 2) {
      setError("Please select exactly 2 facility preferences.");
      setLoading(false);
      return;
    }

    try {
      // Ambil user_id dari cookies (pastikan saat login anda sudah menyimpan user_id dengan kunci yang sesuai)
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID not found. Please login again.");
        setLoading(false);
        return;
      }

      const response = await axios.post(
        "http://127.0.0.1:5000/api/user/preferences",
        {
          user_id: userId,
          preferensi_jarak_minimal: parseInt(minimumDistance, 10),
          preferensi_jarak_maksimal: parseInt(maximumDistance, 10),
          preferensi_fasilitas: selectedFacilities.join(", "),
        },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = response.data;
      setSuccess(data.message || "Preferences updated successfully!");
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || "Failed to update preferences.");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2021] flex items-center justify-center font-montserrat">
      <div className="max-w-md w-full bg-[#1B2021] shadow-xl rounded px-8 py-6 text-[#E3DCC2]">
        <h2 className="text-2xl font-bold text-center mb-6">
          User Preferences
        </h2>
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
          {/* Distance Preferences */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Distance Preference (in Kilometer)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                id="minimumDistance"
                placeholder="Min"
                className="w-1/3 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867] text-[#1B2021]"
                value={minimumDistance}
                onChange={(e) => setMinimumDistance(e.target.value)}
                required
              />
              <span>to</span>
              <input
                type="text"
                id="maximumDistance"
                placeholder="Max"
                className="w-1/3 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#A6A867] text-[#1B2021]"
                value={maximumDistance}
                onChange={(e) => setMaximumDistance(e.target.value)}
                required
              />
              <span className="ml-2">Km</span>
            </div>
          </div>
          {/* Facilities Preferences */}
          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">
              Facilities Preferences
            </label>
            <div className="grid grid-cols-2 gap-2">
              {facilityOptions.map((facility) => (
                <label key={facility} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={facility}
                    onChange={handleFacilityChange}
                    className="form-checkbox h-4 w-4 text-[#A6A867]"
                  />
                  <span className="text-sm">{facility}</span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-1 text-gray-300">
              Please select exactly 2 options.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[#E3DCC2] hover:bg-[#A6A867] text-[#1B2021] font-bold py-2 px-4 rounded transition-colors duration-300 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Submitting..." : "Submit Preferences"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserPreferences;
