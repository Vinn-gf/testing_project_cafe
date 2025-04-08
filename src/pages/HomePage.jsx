import React, { useEffect, useState } from "react";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";

const HomePage = () => {
  const [cafes, setCafes] = useState([]);
  const [UserLocation, setUserLocation] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  // const backgroundImageUrl = require("../assets/image/hero-bg.jpg");
  const [DistanceFetched, setDistanceFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");

  // ✅ [UPDATE] Fungsi helper untuk parsing jarak (misalnya: "2.4 km" => 2400)
  const parseDistance = (distanceText) => {
    if (!distanceText || distanceText === "N/A") {
      return Infinity;
    }
    const parts = distanceText.split(" ");
    const num = parseFloat(parts[0].replace(",", "."));
    if (parts[1] && parts[1].toLowerCase() === "km") {
      return num * 1000;
    }
    return num;
  };

  // Fetch data cafe dari API Flask python
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/data`);
        if (!response.ok) {
          throw new Error("Kafe tidak ditemukan");
        }
        const data = await response.json();
        setCafes(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCafe();
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  // Ambil lokasi user
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("Error getting user location:", error)
      );
    } else {
      console.error("Geolocation tidak didukung oleh browser ini.");
    }
  }, []);

  // Logging untuk melihat perubahan UserLocation
  useEffect(() => {
    if (UserLocation) {
      console.log("User location:", UserLocation);
    }
  }, [UserLocation]);

  useEffect(() => {
    if (UserLocation && cafes.length > 0 && !DistanceFetched) {
      const apiKey = process.env.REACT_APP_GOMAPS_API_KE;

      const updateCafesWithDistance = cafes.map((cafe) => {
        const cafeLat = parseFloat(cafe.latitude);
        const cafeLong = parseFloat(cafe.longitude);
        const userLat = UserLocation.latitude;
        const userLong = UserLocation.longitude;

        const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;

        return fetch(url)
          .then((response) => response.json())
          .then((distanceData) => {
            let distanceText = "N/A";
            let durationText = "N/A";
            if (
              distanceData.rows &&
              distanceData.rows[0] &&
              distanceData.rows[0].elements &&
              distanceData.rows[0].elements[0]
            ) {
              distanceText = distanceData.rows[0].elements[0].distance.text;
              durationText = distanceData.rows[0].elements[0].duration.text;
            }
            return { ...cafe, distance: distanceText, duration: durationText };
          })
          .catch((error) => {
            console.error(
              `Error fetching distance for ${cafe.nama_kafe}:`,
              error
            );
            return { ...cafe, distance: "N/A", duration: "N/A" };
          });
      });

      Promise.all(updateCafesWithDistance).then((updatedCafes) => {
        // ✅ [UPDATE] Mengurutkan kafe berdasarkan jarak terdekat dan hanya ambil 3 teratas
        const sortedCafes = updatedCafes.sort(
          (a, b) => parseDistance(a.distance) - parseDistance(b.distance)
        );
        setCafes(sortedCafes.slice(0, 3));
        setDistanceFetched(true);
        setDistanceLoading(false);
      });
    }
  }, [UserLocation, cafes, DistanceFetched]);

  if (loading || distanceLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <ColorRing
          visible={true}
          height="80"
          width="80"
          ariaLabel="color-ring-loading"
          wrapperStyle={{}}
          wrapperClass="color-ring-wrapper"
          colors={["#1B2021", "#E3DCC2", "#1B2021", "#E3DCC2", "#1B2021"]}
        />
      </div>
    );
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div className="bg-[#1B2021] overflow-hidden">
      {/* Navbar */}
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] text-[#E3DCC2] mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold tracking-widest">
            Vinn.
          </Link>
          <div className="hidden md:flex space-x-10">
            <Link to="/" className="hover:text-gray-200">
              Home
            </Link>
            <Link to="/about" className="hover:text-gray-200">
              Profile
            </Link>
            <h1
              className="hover:text-gray-200 hover:cursor-pointer"
              onClick={() => {
                CookieStorage.remove(CookieKeys.AuthToken);
                navigate("/login");
              }}
            >
              Logout
            </h1>
          </div>
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="focus:outline-none"
            >
              {isOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="md:hidden">
            <Link to="/" className="block p-2">
              Home
            </Link>
            <Link to="/about" className="block p-2">
              Profile
            </Link>
          </div>
        )}
      </div>
      {/* Navbar */}

      {/* Hero */}
      <div className="hero-section relative bg-cover bg-(url['../assets/image/hero-bg2.jpg']) bg-center px-4 py-8 h-[65vh]">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 w-[90%] mx-auto">
          <h1 className="welcome-text font-montserrat text-[#E3DCC2] font-bold text-[4rem] tracking-wide">
            Welcome.
          </h1>
          <p className="text-[#E3DCC2] font-poppins">
            find your comfort and happy place.
          </p>
          <div className="">
            <form
              onSubmit={handleSearch}
              className="mt-4 mb-2 flex items-center font-montserrat gap-2"
            >
              <input
                className="search-input p-2 rounded-md outline-none text-[#E3DCC2] bg-[#1B2021] w-[30%] font-montserrat"
                placeholder="Enter your cafe..."
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <button
                type="submit"
                className="search-btn text-[#E3DCC2] bg-[#1B2021] py-2 px-4 rounded-md hover:bg-[#51513D]"
              >
                Search
              </button>
            </form>
          </div>
          <Link to="/allcafes">
            <button className="check-cafe-btn mt-[5rem] w-[10em] text-[#E3DCC2] p-2 bg-[#1B2021] rounded-md hover:bg-[#51513D]">
              Show All Cafes
            </button>
          </Link>
        </div>
      </div>
      {/* Hero */}

      {/* Recommendation Section */}
      <div className="p-4">
        <h1 className="w-[90%] text-[#e3dcc2] mx-auto font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
          Most Nearby Cafes
        </h1>
        <div className="recommendation-section w-[90%] mx-auto flex items-center justify-between gap-4 h-[55vh]">
          {cafes.map((cafe, index) => {
            let backgroundImageUrl;
            try {
              backgroundImageUrl = require(`../assets/image/card-cafe-${cafe.nomor}.jpg`);
            } catch (error) {
              backgroundImageUrl = require(`../assets/image/card-cafe.jpg`);
            }

            return (
              <div
                key={index}
                className="recommendation-card-container bg-[#1B2021] shadow-lg hover:cursor-pointer rounded-md w-[32%] h-full overflow-hidden text-[#E3DCC2] font-montserrat"
              >
                <Link to={`/detailcafe/${cafe.nomor}`}>
                  <div
                    className="relative h-[15rem] rounded-t-md bg-cover bg-center bg-no-repeat'])"
                    style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <h1 className="text-sm font-bold text-[1.3rem]">
                        {cafe.nama_kafe}
                      </h1>
                    </div>
                  </div>
                </Link>
                <div className="p-4 flex-col items-center gap-4 text-[.95rem]">
                  <p>{cafe.alamat}</p>
                  <h1>{cafe.rating}</h1>
                  {cafe.distance && cafe.duration ? (
                    <div>
                      <h1>
                        Berjarak <strong>{cafe.distance}</strong> dari lokasi
                        anda
                      </h1>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Recommendation Section */}
    </div>
  );
};

export default HomePage;
