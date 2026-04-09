import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin.jsx'
import ProductLanding from './pages/ProductLanding.jsx'
import Storefront from './pages/Storefront.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/p/:productId" element={<ProductLanding />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/Admin123@" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
