import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
// import TestingPage from '../TestingPage'
import HomePage from '../pages/HomePage'

const RoutingPage = () => {
  return (
    <BrowserRouter>
        <Routes>
            <Route path='/' element={<HomePage/>}/>
        </Routes>
    </BrowserRouter>
  )
}

export default RoutingPage
