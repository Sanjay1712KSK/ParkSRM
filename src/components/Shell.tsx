import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, CarFront, CircleHelp, LayoutDashboard, Menu, Settings, ShieldCheck, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'

const links=[{to:'/',label:'Overview',icon:LayoutDashboard},{to:'/parking',label:'Find parking',icon:CarFront},{to:'/timetable',label:'My timetable',icon:CalendarDays},{to:'/wallet',label:'Credit wallet',icon:Wallet},{to:'/admin',label:'Operations',icon:ShieldCheck}]
export default function Shell(){
 const [open,setOpen]=useState(false);const {profile,credits,isDemo}=useStore()
 return <div className="app-shell">
  <aside className={`sidebar ${open?'sidebar-open':''}`}>
   <div className="brand"><div className="brand-mark"><CarFront size={21}/></div><div><b>ParkSRM</b><small>SMART CAMPUS MOBILITY</small></div><button className="icon-btn mobile-close" onClick={()=>setOpen(false)}><X/></button></div>
   <div className="campus-label"><span className="live-dot"/> SRMIST · KTR CAMPUS</div>
   <nav>{links.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setOpen(false)} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={18}/><span>{label}</span>{to==='/parking'&&<span className="nav-pip"/>}</NavLink>)}</nav>
   <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17}/><div><b>Need assistance?</b><span>Campus parking support</span></div></div><div className="profile-mini"><div className="avatar">{profile?.name?.split(' ').map(x=>x[0]).slice(0,2).join('')||'U'}</div><div className="profile-meta"><b>{profile?.name||'Guest user'}</b><span>{profile?.role||'Not registered'}</span></div><Settings size={16} className="muted"/></div></div>
  </aside>
  {open&&<button className="scrim" onClick={()=>setOpen(false)} aria-label="Close menu"/>}
  <main className="main-area"><header className="topbar"><button className="icon-btn menu-btn" onClick={()=>setOpen(true)}><Menu/></button><div className="breadcrumb">Campus mobility <span>/</span> <b>Workspace</b></div><div className="top-actions">{isDemo&&<span className="demo-pill"><span/> DEMO MODE</span>}<div className="credit-chip"><Wallet size={15}/><b>{credits}</b><span>credits</span></div><div className="avatar top-avatar">{profile?.name?.split(' ').map(x=>x[0]).slice(0,2).join('')||'U'}</div></div></header><div className="page-wrap"><Outlet/></div><footer>ParkSRM <span>·</span> SRMIST Kattankulathur <span>·</span> Prototype build</footer></main>
 </div>
}
