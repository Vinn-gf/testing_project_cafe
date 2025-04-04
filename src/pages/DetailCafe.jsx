import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const DetailCafe = () => {
  const { id } = useParams();
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [distance, setDistance] = useState("N/A");
  const [duration, setDuration] = useState("N/A");
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/cafe/${id}`);
        if (!response.ok) {
          throw new Error("Kafe tidak ditemukan");
        }
        const data = await response.json();
        setCafe(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCafe();
  }, [id]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.error("Error mendapatkan lokasi pengguna:", error)
      );
    } else {
      console.error("Geolokasi tidak didukung oleh browser ini.");
    }
  }, []);

  useEffect(() => {
    const fetchDistance = async () => {
      if (userLocation && cafe) {
        setDistanceLoading(true);
        const apiKey = "AlzaSyD-4uTkREKJUnRgRBfkdifFMYkQ-mVVIsH";
        const userLat = userLocation.latitude;
        const userLong = userLocation.longitude;
        const cafeLat = parseFloat(cafe.latitude);
        const cafeLong = parseFloat(cafe.longitude);

        const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;

        try {
          const response = await fetch(url);
          const data = await response.json();
          if (data.rows.length > 0 && data.rows[0].elements.length > 0) {
            setDistance(data.rows[0].elements[0].distance.text);
            setDuration(data.rows[0].elements[0].duration.text);
          }
        } catch (error) {
          console.error("Error mengambil data jarak:", error);
        } finally {
          setDistanceLoading(false);
        }
      }
    };

    fetchDistance();
  }, [userLocation, cafe]);

  if (loading || distanceLoading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      {/* Navbar */}
      <div className="nav-section bg-[#1B2021] p-4 font-montserrat">
        <div className="container w-[90%] mx-auto flex justify-between items-center text-[#E3DCC2]">
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

      {/* Detail Section */}
      <div className="p-4">
        <div className="w-[70%] mx-auto flex gap-[5rem] font-montserrat">
          <div className="detail-card-container hover:cursor-pointer rounded-md w-[40%] text-[#E3DCC2] font-montserrat">
            <div className="card-img-section h-[21rem] shadow-lg rounded-md bg-cover bg-center bg-no-repeat bg-(url-['../assets/image/card-cafe.jpg'])"></div>
          </div>
          <div className="detail-text-section flex flex-col gap-[.25rem]">
            <h1 className="font-extrabold text-[1.8rem]">{cafe.nama_kafe}</h1>
            <h1 className="font-normal text-[1rem]">
              Rating Kafe : {cafe.rating}
            </h1>
            <h1 className="font-normal text-[1rem]">
              Alamat Kafe : {cafe.alamat}
            </h1>
            <h1 className="font-normal text-[1rem]">
              Harga Makanan : {cafe.harga_makanan}
            </h1>
            <h1 className="font-normal text-[1rem]">
              Harga Minuman : {cafe.harga_minuman}
            </h1>
            <h1 className="font-normal text-[1rem]">Jarak : {distance}</h1>
            <h1 className="font-normal text-[1rem]">Durasi : {duration}</h1>
          </div>
        </div>
      </div>
      {/* Detail Section */}
    </div>
  );
};

export default DetailCafe;
