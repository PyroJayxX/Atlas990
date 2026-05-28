import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LeadScoring from './pages/LeadScoring'
import LookalikeMatch from './pages/LookalikeMatch'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/lead-scoring/:ein" element={<LeadScoring />} />
      <Route path="/lookalike-match/:ein" element={<LookalikeMatch />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
