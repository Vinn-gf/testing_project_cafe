import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// import TestingPage from '../TestingPage'
import HomePage from "../pages/HomePage";
import AllCafes from "../pages/AllCafes";
import DetailCafe from "../pages/DetailCafe";
import SearchCafePage from "../pages/SearchCafePage";

const RoutingPage = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/allcafes" element={<AllCafes />} />
        <Route path="/detailcafe/:id" element={<DetailCafe />} />
        <Route path="/search/:keyword" element={<SearchCafePage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RoutingPage;
