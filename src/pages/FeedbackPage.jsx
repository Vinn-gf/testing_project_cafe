import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ColorRing } from "react-loader-spinner";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { API_ENDPOINTS } from "../utils/api_endpoints";

const FeedbackPage = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const userId = CookieStorage.get(CookieKeys.UserToken);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchKeyword.trim()) navigate(`/search/${searchKeyword}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!feedbackText.trim()) {
      setError("Please enter your feedback.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.ADD_FEEDBACK}`,
        { id_user: userId, user_feedback: feedbackText },
        { headers: { "ngrok-skip-browser-warning": true } }
      );
      setSuccess("Thank you for your feedback!");
      setFeedbackText("");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#2D3738] min-h-screen font-montserrat overflow-hidden">
      {/* Navbar */}
      <div className="p-4 bg-[#1B2021] font-montserrat">
        <div className="mx-auto w-[90%] md:w-[95%] lg:w-[90%] flex justify-between items-center text-[#E3DCC2]">
          <Link to="/" className="text-xl font-bold tracking-widest">
            Vinn.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/" className="hover:text-gray-200">
              Home
            </Link>
            <Link to="/recommendation" className="hover:text-gray-200">
              Recommendations
            </Link>
            <Link to="/profile" className="hover:text-gray-200">
              Profile
            </Link>
            <h1
              className="hover:text-gray-200 cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </h1>
          </div>
          <button
            className="md:hidden text-[#E3DCC2] focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden mx-auto w-[90%] space-y-2">
            <Link
              to="/"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Home
            </Link>
            <Link
              to="/recommendation"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Recommendations
            </Link>
            <Link
              to="/profile"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
            >
              Profile
            </Link>
            <Link
              to="#"
              className="block p-2 text-[#E3DCC2] hover:text-gray-200"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                CookieStorage.remove(CookieKeys.UserToken);
                navigate("/login");
              }}
            >
              Logout
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Search & Show All */}
      <div className="px-4 py-6">
        <form
          onSubmit={handleSearch}
          className="w-[90%] md:w-[95%] lg:w-[90%] mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2"
        >
          <input
            type="text"
            placeholder="Enter your cafe..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="p-2 rounded-md outline-none bg-[#1B2021] text-[#E3DCC2] w-full sm:w-2/3 md:w-1/3"
          />
          <button
            type="submit"
            className="bg-[#1B2021] text-[#E3DCC2] py-2 px-4 rounded-md hover:bg-[#51513D] w-full sm:w-auto"
          >
            Search
          </button>
          <Link to="/allcafes">
            <button className="check-cafe-btn w-36 text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D] font-montserrat">
              Show All Cafes
            </button>
          </Link>
        </form>
      </div>

      {/* Feedback Form */}
      <div className="px-4">
        <div className="max-w-2xl mx-auto bg-[#1B2021] p-6 rounded-lg shadow-lg text-[#E3DCC2]">
          <h1 className="text-2xl font-bold mb-4">Your Feedback</h1>
          {error && <p className="text-red-500 mb-2">{error}</p>}
          {success && <p className="text-green-500 mb-2">{success}</p>}
          <form onSubmit={handleSubmit}>
            <textarea
              rows={5}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-2 bg-[#2D3738] text-[#E3DCC2] rounded-md outline-none mb-4"
              placeholder="Write your feedback here..."
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#E3DCC2] text-[#1B2021] py-2 px-6 rounded-md font-bold hover:bg-[#A6A867] disabled:opacity-50"
            >
              {loading ? (
                <ColorRing
                  visible
                  height="24"
                  width="24"
                  colors={["#1B2021"]}
                />
              ) : (
                "Submit"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
