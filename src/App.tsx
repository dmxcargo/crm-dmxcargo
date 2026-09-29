import { Navigate, BrowserRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, ToastProvider, ConfirmProvider, useAuth } from './store/app'
import { Spinner } from './ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Prospects from './pages/Prospects'
import ProspectDetail from './pages/ProspectDetail'
import Pipeline from './pages/Pipeline'
import FollowUps from './pages/FollowUps'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Targets from './pages/Targets'
import { Performance, Annual } from './pages/Reports'
import ImportExport from './pages/ImportExport'
import { Users, Masters, Audit } from './pages/Admin'
// Archives page removed
import Layout from './layout'
import { isStaff } from './utils'

function Guard({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { authed, loading, user } = useAuth()
  if (loading) return <Layout title="Memuat..."><Spinner /></Layout>
  if (!authed) return <Navigate to="/login" replace />
  if (staff && !isStaff(user)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/prospects" replace />} />
              <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
              <Route path="/prospects" element={<Guard><Prospects /></Guard>} />
              <Route path="/prospects/:id" element={<Guard><ProspectDetail /></Guard>} />
              <Route path="/pipeline" element={<Guard><Pipeline /></Guard>} />
              <Route path="/follow-ups" element={<Guard><FollowUps /></Guard>} />
              <Route path="/customers" element={<Guard><Customers /></Guard>} />
              <Route path="/customers/:id" element={<Guard><CustomerDetail /></Guard>} />
              <Route path="/targets" element={<Guard><Targets /></Guard>} />
              <Route path="/reports/performance" element={<Guard><Performance /></Guard>} />
              <Route path="/reports/annual" element={<Guard><Annual /></Guard>} />
              <Route path="/import-export" element={<Guard staff><ImportExport /></Guard>} />
              <Route path="/admin/users" element={<Guard staff><Users /></Guard>} />
              <Route path="/admin/masters" element={<Guard staff><Masters /></Guard>} />
              <Route path="/admin/audit" element={<Guard staff><Audit /></Guard>} />
              {/* /admin/archives removed */}
              <Route path="*" element={<Guard><Dashboard /></Guard>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
