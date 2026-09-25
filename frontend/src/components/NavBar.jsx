// App shell navbar. Links depend on the role, plus the logged in name and a logout button.
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function NavBar() {
  const { user, logout } = useAuth()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">🎓 Campus Works</Link>
        <nav className="nav-links" aria-label="Main navigation">
          {user && <NavLink to="/jobs">Openings</NavLink>}
          {user?.role === 'student' && <NavLink to="/applications">My applications</NavLink>}
          {user?.role === 'professor' && <NavLink to="/my-openings">My openings</NavLink>}
          {user?.role === 'professor' && <NavLink to="/jobs/new">Post opening</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}
        </nav>
        <div className="nav-right">
          {user ? (
            <>
              <span className="user-email" title={user.name}>{user.name} · {user.role}</span>
              <button type="button" className="button secondary" onClick={logout}>Log out</button>
            </>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </div>
      </div>
    </header>
  )
}
