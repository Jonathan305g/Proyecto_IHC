import { Navigate, Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout.jsx'
import PlansPage from './pages/PlansPage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import UpcomingPage from './pages/UpcomingPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/planes" replace />} />
        <Route path="planes" element={<PlansPage />} />
        <Route path="planes/nuevo" element={<UpcomingPage title="Nuevo plan de prueba" section="Planes" />} />
        <Route path="sesiones" element={<SessionsPage />} />
        <Route path="sesiones/nueva" element={<UpcomingPage title="Nueva sesión" section="Sesiones" />} />
        <Route path="resultados" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
