import React, { useEffect, useState } from "react";
import axios from "axios";
import { ColorRing } from "react-loader-spinner";
import { Link, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../utils/cookies";
import { FaStar } from "react-icons/fa";
import { FaLocationDot } from "react-icons/fa6";

// Helper function untuk parsing jarak dari teks (misal "2.4 km") ke meter
const parseDistance = (distanceText) => {
  if (!distanceText || distanceText === "N/A") return Infinity;
  const parts = distanceText.split(" ");
  const num = parseFloat(parts[0].replace(",", "."));
  if (parts[1] && parts[1].toLowerCase() === "km") return num * 1000;
  return num;
};

const HomePage = () => {
  const [cafes, setCafes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");

  // --- Ambil Data Cafe ---
  useEffect(() => {
    const fetchCafes = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/api/data");
        setCafes(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCafes();
  }, []);

  // --- Ambil Lokasi User ---
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

  // --- Ambil Preferensi User (dinamis dari API get_user_by_id) ---
  useEffect(() => {
    const fetchUserPreferences = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        setError("User ID not found. Please login again.");
        return;
      }
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/api/users/${userId}`
        );
        setUserPreferences(response.data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchUserPreferences();
  }, []);

  // --- Fetch Jarak untuk Setiap Cafe dan Hitung Rekomendasi ---
  useEffect(() => {
    const fetchDistancesAndFilter = async () => {
      if (userLocation && cafes.length > 0 && userPreferences) {
        // setDistanceLoading(true);
        const apiKey = process.env.REACT_APP_GOMAPS_API_KE;
        const userLat = userLocation.latitude;
        const userLong = userLocation.longitude;

        // Update setiap cafe dengan jarak dan durasi dari API distancematrix
        const updatedCafesPromises = cafes.map((cafe) => {
          const cafeLat = parseFloat(cafe.latitude);
          const cafeLong = parseFloat(cafe.longitude);
          const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;

          return axios
            .get(url)
            .then((response) => {
              const data = response.data;
              let distanceText = "N/A";
              let durationText = "N/A";
              if (
                data.rows &&
                data.rows[0] &&
                data.rows[0].elements &&
                data.rows[0].elements[0]
              ) {
                distanceText = data.rows[0].elements[0].distance.text;
                durationText = data.rows[0].elements[0].duration.text;
              }
              return {
                ...cafe,
                distance: distanceText,
                duration: durationText,
              };
            })
            .catch((error) => {
              console.error(
                `Error fetching distance for ${cafe.nama_kafe}:`,
                error
              );
              return { ...cafe, distance: "N/A", duration: "N/A" };
            });
        });

        try {
          const updatedCafes = await Promise.all(updatedCafesPromises);

          // Konversi preferensi jarak ke meter (pastikan menggunakan parseFloat agar nilai desimal tidak hilang)
          const minPrefMeter =
            parseFloat(userPreferences.preferensi_jarak_minimal) * 1000;
          const maxPrefMeter =
            parseFloat(userPreferences.preferensi_jarak_maksimal) * 1000;
          const facilitiesArray = userPreferences.preferensi_fasilitas
            ? userPreferences.preferensi_fasilitas
                .split(",")
                .map((s) => s.trim().toLowerCase())
            : [];

          // Filter kafe: memenuhi syarat jarak dan fasilitas
          let filteredCafes = updatedCafes.filter((cafe) => {
            const cafeDistanceMeter = parseDistance(cafe.distance);
            const distanceMatch =
              cafeDistanceMeter >= minPrefMeter &&
              cafeDistanceMeter <= maxPrefMeter;
            const facilityMatch =
              facilitiesArray.length > 0
                ? facilitiesArray.some((facility) => {
                    return (
                      cafe.fasilitas &&
                      cafe.fasilitas.toLowerCase().includes(facility)
                    );
                  })
                : true;
            return distanceMatch && facilityMatch;
          });

          // Jika jumlah café gabungan kurang dari 6, tambahkan café yang memenuhi syarat fasilitas saja
          if (filteredCafes.length < 6) {
            const facilityOnlyCafes = updatedCafes.filter((cafe) => {
              return facilitiesArray.length > 0
                ? facilitiesArray.some(
                    (facility) =>
                      cafe.fasilitas &&
                      cafe.fasilitas.toLowerCase().includes(facility)
                  )
                : false;
            });
            // Gabungkan dengan filteredCafes tanpa duplikat (misal, dibandingkan dengan nomor café)
            const combinedCafes = [...filteredCafes];
            facilityOnlyCafes.forEach((cafe) => {
              if (
                !combinedCafes.some((existing) => existing.nomor === cafe.nomor)
              ) {
                combinedCafes.push(cafe);
              }
            });
            // Urutkan berdasarkan jarak terdekat
            filteredCafes = combinedCafes.sort(
              (a, b) => parseDistance(a.distance) - parseDistance(b.distance)
            );
          } else {
            // Urutkan café yang memenuhi kriteria jarak & fasilitas
            filteredCafes = filteredCafes.sort(
              (a, b) => parseDistance(a.distance) - parseDistance(b.distance)
            );
          }

          // Ambil 6 rekomendasi teratas
          setCafes(filteredCafes.slice(0, 6));
        } catch (err) {
          console.error("Error during recommendation processing:", err);
        } finally {
          setDistanceLoading(false);
        }
      }
    };

    fetchDistancesAndFilter();
  }, [userLocation, cafes, userPreferences]);

  const handleSearch = (event) => {
    event.preventDefault();
    if (searchKeyword.trim()) {
      navigate(`/search/${searchKeyword}`);
    }
  };

  if (loading || distanceLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-gray-100">
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
    return <p className="text-center text-red-500 mt-10">Error: {error}</p>;
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
              className="focus:outline-none text-[#E3DCC2]"
            >
              {isOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="md:hidden">
            <Link to="/" className="block p-2 text-[#E3DCC2]">
              Home
            </Link>
            <Link to="/about" className="block p-2 text-[#E3DCC2]">
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
        <div className="w-[90%] mx-auto">
          <h1 className="text-[#e3dcc2] font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
            Recommended Cafes Based on Your Preferences
          </h1>
        </div>
        <div className="recommendation-section w-[90%] mx-auto flex flex-wrap items-center gap-[1.25rem]">
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
                    className="relative h-[15rem] rounded-t-md bg-cover bg-center bg-no-repeat"
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
                  <span className="flex gap-[0.5rem]">
                    <span className="flex items-center relative -top-[0.05rem]">
                      <FaLocationDot />
                    </span>
                    <p>{cafe.alamat}</p>
                  </span>
                  <span className="flex gap-[0.5rem]">
                    <span className="flex items-center relative -top-[0.05rem]">
                      <FaStar />
                    </span>
                    <p>{cafe.rating}</p>
                  </span>
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
