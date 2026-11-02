import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState, LedgerEntry, Profile, Reservation, TimetableSession } from './types'
import { initialState } from './demo'
import { addMinutes } from './time'

const KEY = 'parksrm-demo-state-v1'
type Store = AppState & {
  isDemo: boolean; saveProfile:(p:Profile)=>void; importTimetable:(s:TimetableSession[])=>void
  reserve:(zoneId:string,date:string,start:string,end:string)=>{ok:boolean;message:string}
  checkout:(id:string,late?:boolean)=>void; cancel:(id:string)=>void; reset:()=>void
}
const Context = createContext<Store | null>(null)
const uid = () => crypto.randomUUID()
export function StoreProvider({children}:{children:ReactNode}) {
  const [state,setState] = useState<AppState>(() => {
    try { const raw=localStorage.getItem(KEY); return raw ? {...initialState,...JSON.parse(raw)} : initialState } catch { return initialState }
  })
  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(state))},[state])
  const api = useMemo<Store>(()=>({
    ...state,isDemo:true,
    saveProfile:(profile)=>setState({...state,profile,onboardingComplete:true}),
    importTimetable:(timetable)=>setState({...state,timetable}),
    reserve:(zoneId,date,start,end)=>{
      const zone=state.zones.find(z=>z.id===zoneId)
      if (!zone) return {ok:false,message:'Parking zone not found'}
      if (state.credits<25) return {ok:false,message:'You need 25 available credits'}
      if (zone.occupied>=zone.total) return {ok:false,message:'This zone is full'}
      const conflict=state.reservations.some(r=>r.date===date && r.zoneId===zoneId && !['cancelled','completed','late'].includes(r.status) && start<r.end && end>r.start)
      if(conflict) return {ok:false,message:'You already have an overlapping reservation in this zone'}
      const id=uid(), now=new Date().toISOString()
      const reservation:Reservation={id,zoneId,slotLabel:`${zone.name} · Demo slot`,date,start,end,graceEnd:addMinutes(end,10),status:'active',createdAt:now,creditsHeld:25}
      const entry:LedgerEntry={id:uid(),type:'hold',amount:-25,note:`25 credits held for ${zone.name}`,createdAt:now,reservationId:id}
      setState({...state,credits:state.credits-25,reservations:[reservation,...state.reservations],ledger:[entry,...state.ledger]})
      return {ok:true,message:'Reservation confirmed — 25 credits held'}
    },
    checkout:(id,late=false)=>{
      const r=state.reservations.find(x=>x.id===id); if(!r || !['active','checked-in'].includes(r.status)) return
      const entry:LedgerEntry={id:uid(),type:late?'forfeit':'release',amount:late?0:25,note:late?'Reservation hold forfeited after grace period':'Reservation hold released after on-time checkout',createdAt:new Date().toISOString(),reservationId:id}
      setState({...state,credits:late?state.credits:state.credits+25,reservations:state.reservations.map(x=>x.id===id?{...x,status:late?'late':'completed'}:x),ledger:[entry,...state.ledger]})
    },
    cancel:(id)=>{
      const r=state.reservations.find(x=>x.id===id); if(!r || !['active','checked-in'].includes(r.status)) return
      const entry:LedgerEntry={id:uid(),type:'release',amount:25,note:'Reservation cancelled; hold released',createdAt:new Date().toISOString(),reservationId:id}
      setState({...state,credits:state.credits+25,reservations:state.reservations.map(x=>x.id===id?{...x,status:'cancelled'}:x),ledger:[entry,...state.ledger]})
    },
    reset:()=>setState(initialState),
  }),[state])
  return <Context.Provider value={api}>{children}</Context.Provider>
}
export function useStore(){const v=useContext(Context);if(!v)throw new Error('StoreProvider missing');return v}
