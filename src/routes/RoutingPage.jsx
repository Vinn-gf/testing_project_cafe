import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import TestingPage from '../TestingPage'

const RoutingPage = () => {
  return (
    <BrowserRouter>
        <Routes>
            <Route path='/' element={<TestingPage/>}/>
        </Routes>
    </BrowserRouter>
  )
}

export default RoutingPage
