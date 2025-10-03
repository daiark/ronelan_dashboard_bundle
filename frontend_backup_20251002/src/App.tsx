import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import MachineDetailPage from './pages/MachineDetailPage'
import ErrorBoundary from './components/ErrorBoundary'
import DncFeederPage from './pages/DncFeederPage'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App min-h-screen bg-dark-900 text-dark-100">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/machine/:machineId" element={<MachineDetailPage />} />
            <Route path="/dnc" element={<DncFeederPage />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App
