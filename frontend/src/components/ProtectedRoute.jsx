/*
 * Route guard. Shows a spinner while the initial auth check runs,
 * sends logged out users to /login, and renders the page otherwise.
 */
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Spinner from './Spinner.jsx'

export default function ProtectedRoute({ children }) {
  const { user, checking } = useAuth()
  if (checking) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}
