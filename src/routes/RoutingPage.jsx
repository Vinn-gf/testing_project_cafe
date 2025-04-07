import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// import TestingPage from '../TestingPage'
import HomePage from "../pages/HomePage";
import AllCafes from "../pages/AllCafes";
import DetailCafe from "../pages/DetailCafe";
import SearchCafePage from "../pages/SearchCafePage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ProtectedTokenUser from "../components/ProtectedComponents/ProtectedTokenUser";
import UserPreferences from "../pages/UserPreferences";

const RoutingPage = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/user_preferences" element={<UserPreferences />} />
        <Route
          path="/"
          element={
            <ProtectedTokenUser>
              <HomePage />
            </ProtectedTokenUser>
          }
        />
        <Route
          path="/allcafes"
          element={
            <ProtectedTokenUser>
              <AllCafes />
            </ProtectedTokenUser>
          }
        />
        <Route
          path="/detailcafe/:id"
          element={
            <ProtectedTokenUser>
              <DetailCafe />
            </ProtectedTokenUser>
          }
        />
        <Route
          path="/search/:keyword"
          element={
            <ProtectedTokenUser>
              <SearchCafePage />
            </ProtectedTokenUser>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default RoutingPage;
