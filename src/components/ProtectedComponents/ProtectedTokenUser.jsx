import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import axios from "axios";

function ProtectedTokenUser({ children }) {
  const navigate = useNavigate();

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
        const response = await axios.get(
          `http://127.0.0.1:5000/api/users/${userId}`
        );

        const userPreference = response.data;
        if (
          !userPreference.preferensi_jarak ||
          userPreference.preferensi_jarak.trim() === "" ||
          !userPreference.preferensi_fasilitas ||
          userPreference.preferensi_fasilitas.trim() === ""
        ) {
          navigate("/user_preferences", { replace: true });
        }
      } catch (error) {
        console.error("Error checking user preferences:", error);
        navigate("/login", { replace: true });
      }
    };

    checkPreferenceValidation();
  }, [navigate]);

  return children;
}

export default ProtectedTokenUser;
