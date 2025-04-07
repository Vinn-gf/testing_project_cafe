import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";
// import { CookieKeys, CookieStorage } fro../../utils/cookiesies";
// import { CookieStorage } from "../../../utils/cookies";

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

  return children;
}

export default ProtectedTokenUser;
