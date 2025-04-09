import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import { ColorRing } from "react-loader-spinner";

function ProtectedTokenUser({ children }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const checkUserValidation = async () => {
      try {
        const tokenCheck = CookieStorage.get(CookieKeys.AuthToken);
        if (!tokenCheck) {
          navigate("/login");
          return;
        }
      } catch (error) {
        console.error(error);
        navigate("/login");
      }
    };

    checkUserValidation();
  }, [navigate]);

  useEffect(() => {
    const checkPreferenceValidation = async () => {
      const userId = CookieStorage.get(CookieKeys.UserToken);
      if (!userId) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/users/${userId}`
        );
        if (!response.ok) {
          throw new Error("User not found");
        }
        const userPreference = await response.json();
        if (
          !userPreference.preferensi_jarak ||
          userPreference.preferensi_jarak.trim() === "" ||
          !userPreference.preferensi_fasilitas ||
          userPreference.preferensi_fasilitas.trim() === ""
        ) {
          navigate("/user_preferences", { replace: true });
        }
        setIsVerified(true);
      } catch (error) {
        console.error("Error checking user preferences:", error);
        navigate("/login", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkPreferenceValidation();
  }, [navigate]);

  if (isLoading) {
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

  if (isLoading) return null;

  if (isVerified) return null;

  return children;
}

export default ProtectedTokenUser;
