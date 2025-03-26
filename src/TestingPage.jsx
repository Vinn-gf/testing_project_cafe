import React, { useEffect, useState } from 'react';

const TestingPage = () => {
  const [cafes, setCafes] = useState([]);
  const [UserLocation, setUserLocation] = useState(null);
  const [DistanceFetched, setDistanceFetched] = useState(false);

  // Fetch data cafe dari API Flask
  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/data')
      .then((response) => response.json())
      .then((data) => {
        console.log("Data dari API:", data);
        setCafes(data);
      })
      .catch((error) => console.error('Error fetching data:', error));
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
          // Tidak mencetak UserLocation di sini karena update state bersifat asinkron.
        },
        (error) => console.error('Error getting user location:', error)
      );
    } else {
      console.error('Geolocation tidak didukung oleh browser ini.');
    }
  }, []);

  // Logging untuk melihat perubahan UserLocation
  useEffect(() => {
    if (UserLocation) {
      console.log("User location:", UserLocation);
    }
  }, [UserLocation]);

  // Hitung jarak untuk setiap cafe menggunakan API GoMaps Distance Matrix
  // Fetch hanya dilakukan satu kali setelah UserLocation dan data cafes tersedia
  useEffect(() => {
    if (UserLocation && cafes.length > 0 && !DistanceFetched) {
      const apiKey = 'AlzaSyBxzR3buUPQhlzQiYGQyQM7vUhQdUVI3JA';
      
      const updateCafesWithDistance = cafes.map((cafe) => {
        const cafeLat = parseFloat(cafe.latitude);
        const cafeLong = parseFloat(cafe.longitude);
        const userLat = UserLocation.latitude;
        const userLong = UserLocation.longitude;
  
        const url = `https://maps.gomaps.pro/maps/api/distancematrix/json?destinations=${cafeLat},${cafeLong}&origins=${userLat},${userLong}&key=${apiKey}`;
  
        return fetch(url)
          .then(response => response.json())
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
            console.error(`Error fetching distance for ${cafe.nama_kafe}:`, error);
            return { ...cafe, distance: "N/A", duration: "N/A" };
          });
      });
      
      Promise.all(updateCafesWithDistance).then((updatedCafes) => {
        setCafes(updatedCafes);
        setDistanceFetched(true);
      });
    }
  }, [UserLocation, cafes, DistanceFetched]);

  return (
    <div>
      <h1>Data Cafe</h1>
      {cafes.map((cafe, index) => (
        <div key={index}>
          <p><strong>Nomor:</strong> {cafe.nomor}</p>
          <p><strong>Nama Kafe:</strong> {cafe.nama_kafe}</p>
          <p><strong>Alamat:</strong> {cafe.alamat}</p>
          <p><strong>Link Maps:</strong> {cafe.link_maps}</p>
          <p><strong>Latitude:</strong> {cafe.latitude}</p>
          <p><strong>Longitude:</strong> {cafe.longitude}</p>
          <p><strong>Desain:</strong> {cafe.desain}</p>
          <p><strong>Fasilitas:</strong> {cafe.fasilitas}</p>
          <p><strong>Harga Makanan:</strong> {cafe.harga_makanan}</p>
          <p><strong>Harga Minuman:</strong> {cafe.harga_minuman}</p>
          <p><strong>Rating:</strong> {cafe.rating}</p>
          {/* Tampilkan jarak dan durasi jika sudah dihitung */}
          {cafe.distance && cafe.duration ? (
            <>
              <p><strong>Jarak:</strong> {cafe.distance}</p>
              <p><strong>Durasi:</strong> {cafe.duration}</p>
            </>
          ) : (
            <p>Menghitung jarak...</p>
          )}
          <hr />
        </div>
      ))}

      {/* Opsional: Tampilkan lokasi user */}
      {UserLocation && (
        <div>
          <p><strong>Latitude User:</strong> {UserLocation.latitude}</p>
          <p><strong>Longitude User:</strong> {UserLocation.longitude}</p>
        </div>
      )}
    </div>
  );
};

export default TestingPage;
