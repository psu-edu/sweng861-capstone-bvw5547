// Top level component. Auth provider, the shared navbar, and all routes.
// /login is public. Everything else is wrapped in ProtectedRoute.
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import NavBar from './components/NavBar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import JobsPage from './pages/JobsPage.jsx'
import JobDetailPage from './pages/JobDetailPage.jsx'
import JobFormPage from './pages/JobFormPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import MyApplicationsPage from './pages/MyApplicationsPage.jsx'

function guard(element) {
  return <ProtectedRoute>{element}</ProtectedRoute>
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/jobs" element={guard(<JobsPage />)} />
          <Route path="/my-openings" element={guard(<JobsPage mine />)} />
          <Route path="/jobs/new" element={guard(<JobFormPage />)} />
          <Route path="/jobs/:id" element={guard(<JobDetailPage />)} />
          <Route path="/jobs/:id/edit" element={guard(<JobFormPage />)} />
          <Route path="/applications" element={guard(<MyApplicationsPage />)} />
          <Route path="/profile" element={guard(<ProfilePage />)} />
          <Route path="*" element={<Navigate to="/jobs" replace />} />
        </Routes>
      </main>
    </AuthProvider>
  )
}
