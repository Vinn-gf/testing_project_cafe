import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
import axios from "axios";
import { API_ENDPOINTS } from "../../utils/api_endpoints";

function ProtectedTokenUser({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const checkUserValidation = async () => {
      try {
        const tokenCheck = CookieStorage.get(CookieKeys.AuthToken);
        const userIdCheck = CookieStorage.get(CookieKeys.UserToken);
        if (!tokenCheck || !userIdCheck) {
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
      const userToken = CookieStorage.get(CookieKeys.AuthToken);
      if (!userId || !userToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL_SERVER}${API_ENDPOINTS.GET_USER_BY_ID}${userId}`,
          {
            headers: {
              "ngrok-skip-browser-warning": true,
            },
          }
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
          console.log("heloo");
          console.log(
            "test",
            userPreference.preferensi_jarak_minimal,
            userPreference.preferensi_jarak_maksimal,
            userPreference.preferensi_fasilitas
          );
        } else if (
          !PreferencesEmpty &&
          location.pathname === "/user_preferences"
        ) {
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("Error checking user preferences:", error);
        navigate("/user_preference", { replace: true });
      }
    };

    checkPreferenceValidation();
  }, [navigate, location]);

  return children;
}

export default ProtectedTokenUser;
