import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import { StoreProvider, useStore } from './lib/store'
import { isSupabaseConfigured } from './lib/supabase'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Parking = lazy(() => import('./pages/Parking'))
const Timetable = lazy(() => import('./pages/Timetable'))
const Wallet = lazy(() => import('./pages/Wallet'))
const Admin = lazy(() => import('./pages/Admin'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Sustainability = lazy(() => import('./pages/Sustainability'))

function AppRoutes() {
  const { onboardingComplete, profile } = useStore()
  const setupRequired = !onboardingComplete || (isSupabaseConfigured && !profile?.backendUserId)
  return <Suspense fallback={<div className="page-loading">Loading workspace…</div>}>
    <Routes>
      <Route path="/setup" element={<Onboarding/>}/>
      <Route element={setupRequired ? <Navigate to="/setup" replace/> : <Shell/>}>
        <Route index element={!setupRequired ? <Dashboard/> : <Navigate to="/setup"/>}/>
        <Route path="/parking" element={<Parking/>}/>
        <Route path="/timetable" element={<Timetable/>}/>
        <Route path="/wallet" element={<Wallet/>}/>
        <Route path="/sustainability" element={<Sustainability/>}/>
        <Route path="/admin" element={<Admin/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </Suspense>
}

export default function App() {
  return <StoreProvider><AppRoutes/></StoreProvider>
}
