import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import axios from "axios";

function ProtectedTokenUser({ children }) {
  const navigate = useNavigate();
  var location = useLocation();

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
        const PreferencesEmpty =
          userPreference.preferensi_jarak_minimal === null ||
          userPreference.preferensi_jarak_minimal === 0 ||
          userPreference.preferensi_jarak_maksimal === null ||
          userPreference.preferensi_jarak_maksimal === 0 ||
          userPreference.preferensi_fasilitas.trim() === "";
        if (PreferencesEmpty && location.pathname !== "/user_preferences") {
          navigate("/user_preferences", { replace: true });
        } else if (
          !PreferencesEmpty &&
          location.pathname === "/user_preferences"
        ) {
          navigate(-1, { replace: true });
        }
      } catch (error) {
        console.error("Error checking user preferences:", error);
        navigate("/login", { replace: true });
      }
    };

    checkPreferenceValidation();
  }, [navigate, location]);

  return children;
}

export default ProtectedTokenUser;
