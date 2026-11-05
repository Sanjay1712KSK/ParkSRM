import './Sustainability.css'
import { useMemo, useState } from 'react'
import { Activity, ArrowDownRight, BatteryCharging, CarFront, Cloud, Gauge, Leaf, Route, Zap } from 'lucide-react'

const DEFAULT_TRIP_KM = 1.2
const DEFAULT_OPTIMIZED_KM = 0.3
const DEFAULT_KM_PER_LITRE = 12
const DEFAULT_KG_CO2_PER_LITRE = 2.31

export default function Sustainability() {
  const [baselineKm, setBaselineKm] = useState(DEFAULT_TRIP_KM)
  const [optimizedKm, setOptimizedKm] = useState(DEFAULT_OPTIMIZED_KM)
  const [efficiency, setEfficiency] = useState(DEFAULT_KM_PER_LITRE)
  const [bookings, setBookings] = useState(100)

  const estimate = useMemo(() => {
    const avoidedKm = Math.max(0, baselineKm - optimizedKm)
    const litres = avoidedKm / Math.max(1, efficiency)
    const co2Kg = litres * DEFAULT_KG_CO2_PER_LITRE
    return {
      avoidedKm,
      litres,
      co2Kg,
      fleetKm: avoidedKm * bookings,
      fleetCo2: co2Kg * bookings,
    }
  }, [baselineKm, optimizedKm, efficiency, bookings])

  return <div className="page-stack sustainability-page">
    <div className="page-title">
      <div><div className="eyebrow">SUSTAINABLE CAMPUS COMPUTING</div><h1>Parking with a lighter footprint.</h1><p>A transparent scenario model for reducing search traffic, idling and unnecessary vehicle circulation.</p></div>
      <span className="eco-label"><Leaf size={14}/> IMPACT ESTIMATOR</span>
    </div>

    <section className="sustain-hero">
      <div className="sustain-hero-copy">
        <div className="hero-tag"><Leaf size={14}/> SMARTER MOBILITY · LESS WASTED MOTION</div>
        <h2>Don't make drivers<br/><em>circle for a space.</em></h2>
        <p>Timetable-aware reservations move parking discovery before arrival. Better information can reduce repeated passes through crowded campus roads.</p>
      </div>
      <div className="sustain-orbit"><div className="eco-ring ring-a"/><div className="eco-ring ring-b"/><div className="eco-symbol"><Leaf size={40}/></div><span>ESTIMATE · NOT MEASURED</span></div>
    </section>

    <section className="impact-grid">
      <div className="impact-card impact-primary"><div className="impact-kicker"><Route size={15}/> AVOIDED SEARCH DISTANCE</div><strong>{estimate.avoidedKm.toFixed(2)} <small>km / vehicle</small></strong><span>Difference between your baseline and optimized search assumptions</span></div>
      <div className="impact-card"><div className="impact-kicker"><BatteryCharging size={15}/> FUEL AVOIDED</div><strong>{estimate.litres.toFixed(3)} <small>L / vehicle</small></strong><span>Distance avoided ÷ assumed vehicle efficiency</span></div>
      <div className="impact-card"><div className="impact-kicker"><Cloud size={15}/> CO₂ AVOIDED</div><strong>{(estimate.co2Kg*1000).toFixed(0)} <small>g / vehicle</small></strong><span>Illustrative tailpipe CO₂ estimate</span></div>
      <div className="impact-card"><div className="impact-kicker"><Activity size={15}/> SCENARIO TOTAL</div><strong>{estimate.fleetCo2.toFixed(1)} <small>kg CO₂</small></strong><span>{bookings} bookings under these assumptions</span></div>
    </section>

    <section className="calculator-layout">
      <div className="panel">
        <div className="section-heading"><div><span className="eyebrow">SCENARIO CONTROLS</span><h3>Change the assumptions</h3></div><Gauge size={18} className="muted"/></div>
        <div className="scenario-fields">
          <label className="scenario-field">Baseline parking search distance <b>{baselineKm.toFixed(1)} km</b><input type="range" min="0.2" max="5" step="0.1" value={baselineKm} onChange={e=>setBaselineKm(Number(e.target.value))}/></label>
          <label className="scenario-field">Optimized search distance <b>{optimizedKm.toFixed(1)} km</b><input type="range" min="0" max="3" step="0.1" value={optimizedKm} onChange={e=>setOptimizedKm(Number(e.target.value))}/></label>
          <label className="scenario-field">Vehicle efficiency <b>{efficiency.toFixed(0)} km/L</b><input type="range" min="5" max="30" step="1" value={efficiency} onChange={e=>setEfficiency(Number(e.target.value))}/></label>
          <label className="scenario-field">Bookings in the scenario <b>{bookings}</b><input type="range" min="1" max="1000" step="1" value={bookings} onChange={e=>setBookings(Number(e.target.value))}/></label>
          <button className="secondary-btn" onClick={()=>{setBaselineKm(DEFAULT_TRIP_KM);setOptimizedKm(DEFAULT_OPTIMIZED_KM);setEfficiency(DEFAULT_KM_PER_LITRE);setBookings(100)}}>Reset assumptions</button>
        </div>
      </div>
      <div className="panel impact-result">
        <span className="eyebrow">ESTIMATED SCENARIO OUTCOME</span>
        <div className="big-impact"><span>Potential CO₂ reduction</span><strong>{estimate.fleetCo2.toFixed(1)} <small>kg</small></strong></div>
        <div className="result-line"><span>Vehicle distance avoided</span><b>{estimate.fleetKm.toFixed(1)} km</b></div>
        <div className="result-line"><span>Fuel avoided</span><b>{(estimate.litres*bookings).toFixed(2)} L</b></div>
        <div className="result-line"><span>Tailpipe factor</span><b>{DEFAULT_KG_CO2_PER_LITRE.toFixed(2)} kg/L</b></div>
        <div className="notice warning"><Zap size={16}/> This is a modelled scenario, not measured savings. Replace assumptions with campus traffic counts and fleet-specific fuel data for a study.</div>
      </div>
    </section>

    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">SUSTAINABLE COMPUTING DESIGN</span><h3>Where the sustainability comes from</h3></div><Leaf size={18} className="muted"/></div>
      <div className="sustainability-principles">
        <article><div className="principle-icon"><CarFront/></div><div><b>1. Avoid vehicle search loops</b><p>Schedule-aware booking and a clear zone choice can reduce repeated low-speed circulation and idling. This is the main direct-impact hypothesis to validate.</p></div></article>
        <article><div className="principle-icon"><Zap/></div><div><b>2. Make the software itself lean</b><p>Use a small React interface, no autoplay media, no polling loop, no heavyweight map tiles and no continuous background sensor streaming in the demo. Fetch only when a user acts.</p></div></article>
        <article><div className="principle-icon"><Activity/></div><div><b>3. Reduce backend work</b><p>Transactional RPCs combine slot allocation, wallet locking and ledger writes into one database transaction. Idempotency prevents duplicate retries from repeating work or charging twice.</p></div></article>
        <article><div className="principle-icon"><BatteryCharging/></div><div><b>4. Design for low-power edge hardware</b><p>Optional occupancy sensors should report only state changes, sleep between readings and send compact events. Avoid continuous video streaming or unnecessary cloud inference.</p></div></article>
        <article><div className="principle-icon"><Cloud/></div><div><b>5. Measure rather than assume</b><p>Track requests per booking, transferred bytes, client CPU time, sensor duty cycle and measured vehicle search distance. Report energy per completed reservation, not just server utilisation.</p></div></article>
      </div>
    </section>

    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">MEASUREMENT PLAN</span><h3>How to validate the impact on campus</h3></div><ArrowDownRight size={18} className="muted"/></div>
      <div className="measurement-grid">
        <div><b>Mobility baseline</b><span>Observe search minutes, distance travelled and idle time before/after intervention.</span></div>
        <div><b>Digital footprint</b><span>Record JS bundle size, requests per session, payload bytes and browser CPU time.</span></div>
        <div><b>Backend efficiency</b><span>Measure database compute time, RPC calls per booking and retry rate.</span></div>
        <div><b>Edge efficiency</b><span>Measure sensor on-time, sleep ratio and data bytes per occupancy change.</span></div>
      </div>
    </section>

    <p className="sustain-footnote">Model basis: avoided distance × vehicle fuel consumption × 2.31 kg CO₂ per litre of petrol. Assumptions are editable; real results depend on traffic, vehicle mix, occupancy and driver behaviour. Credits are demonstration points, not money.</p>
  </div>
}
