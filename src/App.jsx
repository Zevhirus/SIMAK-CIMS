import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import UmumDashboard from './pages/UmumDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ObDashboard from './pages/ObDashboard'
import Inspeksi from './pages/Inspeksi'
import Rekap from './pages/Rekap'
import KerusakanBarang from './pages/KerusakanBarang'
import { Spinner } from './components/ui'

const HOME = { umum: '/umum', admin: '/admin', ob: '/ob' }

function Guard({ role, children }) {
  const roles = Array.isArray(role) ? role : [role]
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Spinner full />
  if (!roles.includes(profile.role)) return <Navigate to={HOME[profile.role]} replace />
  return children
}

function Root() {
  const { session, profile, loading } = useAuth()
  if (loading || (session && !profile)) return <Spinner full />
  return <Navigate to={session ? HOME[profile.role] : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<Login />} />
      <Route path="/umum" element={<Guard role="umum"><UmumDashboard /></Guard>} />
      <Route path="/admin" element={<Guard role="admin"><AdminDashboard /></Guard>} />
      <Route path="/ob" element={<Guard role="ob"><ObDashboard /></Guard>} />
      <Route path="/inspeksi" element={<Guard role="admin"><Inspeksi /></Guard>} />
      <Route path="/pemeliharaan" element={<Guard role={['admin', 'ob']}><KerusakanBarang /></Guard>} />
      <Route path="/rekap" element={<Guard role="admin"><Rekap /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
