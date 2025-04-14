import React from "react";
import ReactDOM from "react-dom/client";
import "./assets/css/index.css";
// import TestingPage from './TestingPage';
import RoutingPage from "./routes/RoutingPage";
import { ToastContainer } from "react-toastify";
// import App from './App';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <RoutingPage />
    <ToastContainer />
  </React.StrictMode>
);
