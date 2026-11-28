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
import SessionRunPage from './pages/SessionRunPage.jsx'
import ReviewPage from './pages/ReviewPage.jsx'
import StoryDetailPage from './pages/StoryDetailPage.jsx'
import BacklogPage from './pages/BacklogPage.jsx'
import SprintsPage from './pages/SprintsPage.jsx'
import SprintBoardPage from './pages/SprintBoardPage.jsx'
import SprintClosePage from './pages/SprintClosePage.jsx'
import ComparisonPage from './pages/ComparisonPage.jsx'
import './scrum.css'
import './review.css'
import './backlog.css'

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
        <Route path="sesiones/:id/ejecutar" element={<SessionRunPage />} />
        <Route path="resultados" element={<ResultsPage />} />
        <Route path="revision" element={<ReviewPage />} />
        <Route path="historias/:id" element={<StoryDetailPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="sprints" element={<SprintsPage />} />
        <Route path="sprints/:id/tablero" element={<SprintBoardPage />} />
        <Route path="sprints/:id/cierre" element={<SprintClosePage />} />
        <Route path="comparacion" element={<ComparisonPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
