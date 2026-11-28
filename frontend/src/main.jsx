import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import AuthGate from './components/AuthGate.jsx'
import App from './App.jsx'
import './styles.css'
import './dashboard.css'

const router = createBrowserRouter([{ path: '*', element: <AuthGate><App /></AuthGate> }])

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
