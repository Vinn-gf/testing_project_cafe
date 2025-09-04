// src/components/ProtectedTokenAdmin.jsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CookieKeys, CookieStorage } from "../../utils/cookies";

function ProtectedTokenAdmin({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const tokenCheck = CookieStorage.get(CookieKeys.AuthToken);
        const adminId = CookieStorage.get(CookieKeys.AdminToken);
        if (!tokenCheck || !adminId) {
          navigate("/admin", { replace: true });
          return;
        }
      } catch (err) {
        console.error(err);
        navigate("/admin", { replace: true });
      }
    };

    checkAdmin();
  }, [navigate, location]);

  return children;
}

export default ProtectedTokenAdmin;
