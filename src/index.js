import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
// import TestingPage from './TestingPage';
import RoutingPage from './routes/RoutingPage';
// import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RoutingPage/>
  </React.StrictMode>
);
