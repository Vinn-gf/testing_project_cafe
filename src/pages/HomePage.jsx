import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const HomePage = () => {
  const [cafes, setCafes] = useState([]);
  const [UserLocation, setUserLocation] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  // const backgroundImageUrl = require("../assets/image/hero-bg.jpg");
  // const [DistanceFetched, setDistanceFetched] = useState(false);

  // Fetch data cafe dari API Flask python
  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/data")
      .then((response) => response.json())
      .then((data) => {
        console.log("Data dari API:", data);
        setCafes(data);
      })
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

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

  // Perhitungan jarak user dan lokasi cafe
  // useEffect(() => {
  //   if (UserLocation && cafes.length > 0 && !DistanceFetched) {
  //     const apiKey = 'AlzaSyD-4uTkREKJUnRgRBfkdifFMYkQ-mVVIsH';

  //     const updateCafesWithDistance = cafes.map((cafe) => {
  //       const cafeLat = parseFloat(cafe.latitude);
  //       const cafeLong = parseFloat(cafe.longitude);
  //       const userLat = UserLocation.latitude;
  //       const userLong = UserLocation.longitude;

  //       const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;

  //       return fetch(url)
  //         .then(response => response.json())
  //         .then((distanceData) => {
  //           let distanceText = "N/A";
  //           let durationText = "N/A";
  //           if (
  //             distanceData.rows &&
  //             distanceData.rows[0] &&
  //             distanceData.rows[0].elements &&
  //             distanceData.rows[0].elements[0]
  //           ) {
  //             distanceText = distanceData.rows[0].elements[0].distance.text;
  //             durationText = distanceData.rows[0].elements[0].duration.text;
  //           }
  //           return { ...cafe, distance: distanceText, duration: durationText };
  //         })
  //         .catch((error) => {
  //           console.error(`Error fetching distance for ${cafe.nama_kafe}:`, error);
  //           return { ...cafe, distance: "N/A", duration: "N/A" };
  //         });
  //     });

  //     Promise.all(updateCafesWithDistance).then((updatedCafes) => {
  //       setCafes(updatedCafes);
  //       setDistanceFetched(true);
  //     });
  //   }
  // }, [UserLocation, cafes, DistanceFetched]);

  return (
    <div>
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
          <div className="search-section flex items-center gap-6 mt-8 font-montserrat">
            <input
              className="search-input p-2 rounded-md outline-none text-black w-[70%]"
              placeholder="Enter your cafe..."
              type="text"
            />
            <button className="search-btn text-[#E3DCC2] bg-[#1B2021] p-2 w-[7rem] rounded-md hover:bg-[#51513D]">
              Search
            </button>
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
        <h1 className="w-[90%] mx-auto font-montserrat font-bold text-[1.4rem] tracking-wide mb-4">
          Top Recommendation
        </h1>
        <div className="recommendation-section w-[90%] mx-auto flex items-center justify-between gap-4 h-[55vh]">
          {cafes.slice(0, 5).map((cafe, index) => {
            // const backgroundStyle = {
            //   backgroundImage: `url('https://unsplash.com/photos/a-store-front-with-bicycles-parked-in-front-lb2SXAyrQl8')`,
            // };
            return (
              <div
                key={index}
                className="recommendation--card-container bg-[#1B2021] shadow-lg hover:scale-105 hover:cursor-pointer rounded-md w-[15rem] h-full text-[#E3DCC2] font-montserrat overflow-hidden"
              >
                <Link to={`/detailcafe/${cafe.nomor}`}>
                  {/* Image section dengan overlay teks */}
                  <div
                    className="card-img-section relative h-[15rem] rounded-t-md bg-cover bg-center bg-no-repeat bg-(url['../assets/image/card-cafe.jpg'])"
                    // style={backgroundStyle}
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <h1 className="text-sm font-bold">{cafe.nama_kafe}</h1>
                    </div>
                  </div>
                </Link>
                <div className="p-4 flex-row items-center gap-4">
                  <p>{cafe.alamat}</p>
                  <h1>{cafe.rating}</h1>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Recommendation Section */}

      {/* {cafes.map((cafe, index) => (
        <div className="mt-[20rem]" key={index}>
          <p>
            <strong>Nomor:</strong> {cafe.nomor}
          </p>
          <p>
            <strong>Nama Kafe:</strong> {cafe.nama_kafe}
          </p>
          <p>
            <strong>Alamat:</strong> {cafe.alamat}
          </p>
          <p>
            <strong>Link Maps:</strong> {cafe.link_maps}
          </p>
          <p>
            <strong>Latitude:</strong> {cafe.latitude}
          </p>
          <p>
            <strong>Longitude:</strong> {cafe.longitude}
          </p>
          <p>
            <strong>Desain:</strong> {cafe.desain}
          </p>
          <p>
            <strong>Fasilitas:</strong> {cafe.fasilitas}
          </p>
          <p>
            <strong>Harga Makanan:</strong> {cafe.harga_makanan}
          </p>
          <p>
            <strong>Harga Minuman:</strong> {cafe.harga_minuman}
          </p>
          <p>
            <strong>Rating:</strong> {cafe.rating}
          </p> */}
      {/* Tampilkan jarak dan durasi jika sudah dihitung */}
      {/* {cafe.distance && cafe.duration ? (
            <>
              <p><strong>Jarak:</strong> {cafe.distance}</p>
              <p><strong>Durasi:</strong> {cafe.duration}</p>
            </>
          ) : (
            <p>Menghitung jarak...</p>
            )} */}
      {/* <hr />
        </div>
      ))} */}

      {/* Opsional: Tampilkan lokasi user */}
      {/* {UserLocation && (
        <div>
          <p><strong>Latitude User:</strong> {UserLocation.latitude}</p>
          <p><strong>Longitude User:</strong> {UserLocation.longitude}</p>
        </div>
      )} */}
    </div>
  );
};

export default HomePage;
