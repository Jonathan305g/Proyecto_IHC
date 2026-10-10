import { Navigate, Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout.jsx'
import PlansPage from './pages/PlansPage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import NewPlanPage from './pages/NewPlanPage.jsx'
import PlanDetailPage from './pages/PlanDetailPage.jsx'
import NewSessionPage from './pages/NewSessionPage.jsx'
import SessionDetailPage from './pages/SessionDetailPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/planes" replace />} />
        <Route path="planes" element={<PlansPage />} />
        <Route path="planes/nuevo" element={<NewPlanPage />} />
        <Route path="planes/:id" element={<PlanDetailPage />} />
        <Route path="sesiones" element={<SessionsPage />} />
        <Route path="sesiones/nueva" element={<NewSessionPage />} />
        <Route path="sesiones/:id" element={<SessionDetailPage />} />
        <Route path="resultados" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
