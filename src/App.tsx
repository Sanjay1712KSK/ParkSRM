import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Parking from './pages/Parking'
import Timetable from './pages/Timetable'
import Wallet from './pages/Wallet'
import Admin from './pages/Admin'
import Onboarding from './pages/Onboarding'
import Sustainability from './pages/Sustainability'
import { StoreProvider, useStore } from './lib/store'
function AppRoutes(){const {onboardingComplete}=useStore();return <Routes><Route path="/setup" element={<Onboarding/>}/><Route element={<Shell/>}><Route index element={onboardingComplete?<Dashboard/>:<Navigate to="/setup"/>}/><Route path="/parking" element={<Parking/>}/><Route path="/timetable" element={<Timetable/>}/><Route path="/wallet" element={<Wallet/>}/><Route path="/sustainability" element={<Sustainability/>}/><Route path="/admin" element={<Admin/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
export default function App(){return <StoreProvider><AppRoutes/></StoreProvider>}
