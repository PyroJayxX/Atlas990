import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import FormulaScoring from './pages/FormulaScoring'
import ModelScoring from './pages/ModelScoring'
import LookalikeMatch from './pages/LookalikeMatch'

function App() {
  return (
    <Routes>
      <Route path="/"                     element={<Dashboard />} />
      <Route path="/lead-scoring/formula" element={<FormulaScoring />} />
      <Route path="/lead-scoring/model"   element={<ModelScoring />} />
      <Route path="/lookalike-match"      element={<LookalikeMatch />} />
    </Routes>
  )
}

export default App