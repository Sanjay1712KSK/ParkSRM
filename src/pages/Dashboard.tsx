import { CalendarClock, CarFront, ChevronRight, Clock3, MapPin, Sparkles, Wallet, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { eligibleWindows } from '../lib/time'
export default function Dashboard(){
 const {profile,zones,timetable,reservations,credits}=useStore()
 const total=zones.reduce((a,z)=>a+z.total,0), occupied=zones.reduce((a,z)=>a+z.occupied,0)
 const todayName=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(new Date())
 const windows=eligibleWindows(timetable,todayName)
 return <div className="page-stack">
  <section className="welcome-row"><div><div className="eyebrow">SRMIST · KTR CAMPUS</div><h1>Good morning, {profile?.name?.split(' ')[0]||'there'}<span className="wave">✳</span></h1><p>Your campus day, with parking already thought through.</p></div><Link to="/parking" className="primary-btn"><CarFront size={17}/> Find a parking spot</Link></section>
  <section className="hero-panel"><div className="hero-copy"><div className="hero-tag"><Sparkles size={14}/> SMART PARKING ASSISTANT</div><h2>Arrive. Park.<br/><em>Get on with your day.</em></h2><p>Parking windows are estimated from your timetable. Book a suitable space before you arrive.</p><Link to="/timetable" className="hero-link">Review my schedule <ChevronRight size={16}/></Link></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="parking-pin"><CarFront size={34}/><span>AVAILABLE</span></div><div className="float-note"><span className="live-dot"/> Illustrative inventory <b>{total-occupied} sample spaces</b></div></div></section>
  <section className="metric-grid">
   <Metric label="Sample spaces" value={String(total-occupied)} detail={`Illustrative count · ${zones.length} sample zones`} icon={<CarFront/>} trend="Current snapshot"/>
   <Metric label="Your credit balance" value={`${credits} P`} detail="25 credits held per booking" icon={<Wallet/>} trend="Parking wallet"/>
   <Metric label="Today's free windows" value={String(windows.length)} detail="Based on imported timetable" icon={<CalendarClock/>} trend="Schedule-aware"/>
   <Metric label="Active reservations" value={String(reservations.filter(r=>['active','checked-in'].includes(r.status)).length)} detail="Bookings in progress" icon={<Clock3/>} trend="Your activity"/>
  </section>
  <section className="content-grid"><div className="panel"><div className="section-heading"><div><span className="eyebrow">CAMPUS OVERVIEW</span><h3>Parking zones</h3></div><Link to="/parking" className="text-link">View all <ChevronRight size={15}/></Link></div><div className="zone-list">{zones.slice(0,3).map(z=><div className="zone-row" key={z.id}><div className="zone-icon"><MapPin size={19}/></div><div className="zone-info"><b>{z.name}</b><span>{z.area}</span><div className="progress"><i style={{width:`${z.occupied/z.total*100}%`}}/></div></div><div className="zone-count"><b>{z.total-z.occupied}</b><span>of {z.total} free</span></div></div>)}</div></div>
  <div className="panel schedule-panel"><div className="section-heading"><div><span className="eyebrow">YOUR DAY</span><h3>Your parking windows</h3></div><Link to="/timetable" className="text-link">Schedule <ChevronRight size={15}/></Link></div>{windows.length?windows.slice(0,3).map((w,i)=><div className="window-row" key={i}><div className="window-time">{w.start}<span>—</span>{w.end}</div><div><b>{w.label}</b><small>Class attendance block</small></div><span className="window-dot"/></div>):<div className="empty-inline">No free windows detected for today. Check your timetable.</div>}<div className="note-strip"><Clock3 size={15}/> 10-minute retrieval grace period applies after the booked end time.</div></div></section>
  <section className="bottom-callout"><div className="callout-icon"><Wallet/></div><div><b>Keep your credits in good standing</b><span>25 credits are held when you reserve and released after on-time checkout.</span></div><Link to="/wallet">View wallet <ChevronRight size={15}/></Link></section>
  <section className="sustain-promo"><div className="sustain-promo-icon"><Leaf size={20}/></div><div><b>Make the sustainability case</b><span>Explore how pre-arrival parking information can reduce unnecessary search distance, fuel use and digital waste.</span></div><Link to="/sustainability" className="text-link">View impact model <ChevronRight size={15}/></Link></section>
 </div>
}
function Metric({label,value,detail,icon,trend}:{label:string;value:string;detail:string;icon:ReactNode;trend:string}){return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong>{value}</strong><div className="metric-bottom"><span>{detail}</span><small>{trend}</small></div></div>}
