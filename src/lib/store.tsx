import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppState, LedgerEntry, Profile, Reservation, TimetableSession } from './types'
import { initialState } from './demo'
import { addMinutes, DAYS } from './time'
import { campusTimestamp, isSupabaseConfigured, supabase, SUPABASE_ZONE_IDS } from './supabase'

const KEY = 'parksrm-demo-state-v1'
type ActionResult = { ok: boolean; message: string }
type Store = AppState & {
  isDemo: boolean
  saveProfile: (p: Profile) => void
  importTimetable: (s: TimetableSession[]) => Promise<ActionResult>
  reserve: (zoneId: string, date: string, start: string, end: string) => Promise<ActionResult>
  checkin: (id: string) => Promise<ActionResult>
  checkout: (id: string, late?: boolean) => Promise<ActionResult>
  cancel: (id: string) => Promise<ActionResult>
  reset: () => void
}
const Context = createContext<Store | null>(null)
const uid = () => crypto.randomUUID()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? { ...initialState, ...JSON.parse(raw) } : initialState
    } catch {
      return initialState
    }
  })

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)) }, [state])

  // Supabase is the system of record in configured mode. Hydrate the local UI
  // cache once per authenticated profile; there is deliberately no polling.
  useEffect(() => {
    const userId = state.profile?.backendUserId
    if (!isSupabaseConfigured || !supabase || !userId) return
    let active = true
    const hydrate = async () => {
      const [walletResult, timetableResult, reservationsResult, ledgerResult] = await Promise.all([
        supabase.from('wallets').select('available_credits').eq('user_id', userId).single(),
        supabase.from('timetable_sessions').select('id,day_of_week,starts_at,ends_at,course,location').eq('user_id', userId),
        supabase.from('reservations')
          .select('id,slot_id,starts_at,ends_at,grace_ends_at,status,created_at,parking_slots(slot_code,zone_id)')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
        supabase.from('credit_ledger')
          .select('id,entry_type,available_delta,note,created_at,reservation_id')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      ])
      if (!active || walletResult.error || timetableResult.error || reservationsResult.error || ledgerResult.error) return

      const timetable: TimetableSession[] = (timetableResult.data || []).map(row => ({
        id: row.id,
        day: DAYS[(row.day_of_week || 1) - 1] || 'Monday',
        start: String(row.starts_at).slice(0, 5),
        end: String(row.ends_at).slice(0, 5),
        course: row.course,
        location: row.location || '',
      }))
      const reservations: Reservation[] = (reservationsResult.data || []).map(row => {
        const slot = row.parking_slots as unknown as { slot_code: string; zone_id: string } | null
        const zoneId = Object.entries(SUPABASE_ZONE_IDS).find(([, uuid]) => uuid === slot?.zone_id)?.[0] || 'north'
        const startDate = new Date(row.starts_at)
        const endDate = new Date(row.ends_at)
        const date = startDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        const start = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
        const end = endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
        const rawStatus = row.status as string
        const status: Reservation['status'] = rawStatus === 'checked_in' ? 'checked-in'
          : rawStatus === 'completed' ? 'completed'
          : rawStatus === 'late' ? 'late'
          : rawStatus === 'cancelled' ? 'cancelled'
          : rawStatus === 'expired' ? 'expired' : 'active'
        return {
          id: row.id, zoneId, slotLabel: `${zoneId} · ${slot?.slot_code || 'Physical slot'}`,
          date, start, end, graceEnd: row.grace_ends_at,
          status, createdAt: row.created_at, creditsHeld: 25,
        }
      })
      const ledger: LedgerEntry[] = (ledgerResult.data || []).map(row => ({
        id: row.id,
        type: row.entry_type as LedgerEntry['type'],
        amount: row.available_delta,
        note: row.note,
        createdAt: row.created_at,
        reservationId: row.reservation_id || undefined,
      }))
      setState(current => ({
        ...current,
        credits: walletResult.data.available_credits,
        timetable,
        reservations,
        ledger,
      }))
    }
    void hydrate()
    return () => { active = false }
  }, [state.profile?.backendUserId])


  const api = useMemo<Store>(() => ({
    ...state,
    isDemo: !isSupabaseConfigured,

    saveProfile: (profile) => setState(current => ({
      ...current,
      profile,
      onboardingComplete: true,
      credits: profile.backendAvailableCredits ?? (profile.backendUserId ? current.credits : 100),
      ...(profile.backendUserId ? { timetable: [], reservations: [], ledger: [] } : {}),
    })),

    importTimetable: async (timetable) => {
      if (isSupabaseConfigured) {
        if (!supabase || !state.profile?.backendUserId) {
          return { ok: false, message: 'Verify your SRM email and complete profile setup before syncing a timetable.' }
        }
        const payload = timetable.map(session => ({
          day_of_week: DAYS.findIndex(d => d.toLowerCase() === session.day.toLowerCase()) + 1,
          starts_at: session.start,
          ends_at: session.end,
          course: session.course,
          location: session.location || null,
        }))
        const { error } = await supabase.rpc('replace_user_timetable', { p_sessions: payload })
        if (error) return { ok: false, message: `Timetable sync failed: ${error.message}` }
      }
      setState(current => ({ ...current, timetable }))
      return { ok: true, message: `${timetable.length} timetable sessions saved${isSupabaseConfigured ? ' to Supabase' : ' in this browser demo'}.` }
    },

    reserve: async (zoneId, date, start, end) => {
      const zone = state.zones.find(z => z.id === zoneId)
      if (!zone) return { ok: false, message: 'Parking zone not found' }

      if (isSupabaseConfigured) {
        if (!supabase || !state.profile?.backendVehicleId) {
          return { ok: false, message: 'Complete verified SRM profile setup and register a vehicle before booking.' }
        }
        const backendZoneId = SUPABASE_ZONE_IDS[zoneId]
        if (!backendZoneId) return { ok: false, message: 'This zone is not mapped to the Supabase inventory.' }
        const { data, error } = await supabase.rpc('create_parking_reservation', {
          p_zone_id: backendZoneId,
          p_vehicle_id: state.profile.backendVehicleId,
          p_starts_at: campusTimestamp(date, start),
          p_ends_at: campusTimestamp(date, end),
          p_idempotency_key: uid(),
        })
        if (error) return { ok: false, message: error.message }
        const reply = data as {
          reservation_id: string; slot_id: string; slot_code?: string; grace_ends_at?: string;
          available_credits: number; status: string
        }
        const reservation: Reservation = {
          id: reply.reservation_id,
          zoneId,
          slotLabel: `${zone.name} · ${reply.slot_code || 'Assigned physical slot'}`,
          date, start, end,
          graceEnd: reply.grace_ends_at || addMinutes(end, 10),
          status: 'active',
          createdAt: new Date().toISOString(),
          creditsHeld: 25,
        }
        const ledger: LedgerEntry = {
          id: uid(), type: 'hold', amount: -25,
          note: `25 credits held for ${zone.name} · ${reply.slot_code || 'slot assigned'}`,
          createdAt: new Date().toISOString(), reservationId: reply.reservation_id,
        }
        setState(current => ({
          ...current,
          credits: reply.available_credits,
          reservations: [reservation, ...current.reservations],
          ledger: [ledger, ...current.ledger],
        }))
        return { ok: true, message: `Confirmed. ${reply.slot_code || 'A physical slot'} assigned; 25 credits held transactionally.` }
      }

      if (state.credits < 25) return { ok: false, message: 'You need 25 available credits' }
      if (zone.occupied >= zone.total) return { ok: false, message: 'This zone is full' }
      const conflict = state.reservations.some(r =>
        r.date === date && r.zoneId === zoneId &&
        !['cancelled', 'completed', 'late'].includes(r.status) &&
        start < r.end && end > r.start
      )
      if (conflict) return { ok: false, message: 'You already have an overlapping reservation in this zone' }

      const id = uid(), now = new Date().toISOString()
      const reservation: Reservation = {
        id, zoneId, slotLabel: `${zone.name} · Demo slot`, date, start, end,
        graceEnd: addMinutes(end, 10), status: 'active', createdAt: now, creditsHeld: 25,
      }
      const entry: LedgerEntry = {
        id: uid(), type: 'hold', amount: -25,
        note: `25 credits held for ${zone.name}`, createdAt: now, reservationId: id,
      }
      setState(current => ({
        ...current,
        credits: current.credits - 25,
        reservations: [reservation, ...current.reservations],
        ledger: [entry, ...current.ledger],
      }))
      return { ok: true, message: 'Demo reservation confirmed — 25 credits held.' }
    },

    checkin: async (id) => {
      const reservation = state.reservations.find(r => r.id === id)
      if (!reservation || reservation.status !== 'active') return { ok: false, message: 'Reservation is not awaiting arrival.' }
      if (isSupabaseConfigured) {
        if (!supabase) return { ok: false, message: 'Supabase is not available.' }
        const { error } = await supabase.rpc('check_in_parking_reservation', { p_reservation_id: id })
        if (error) return { ok: false, message: error.message }
      }
      setState(current => ({
        ...current,
        reservations: current.reservations.map(r => r.id === id ? { ...r, status: 'checked-in' } : r),
      }))
      return { ok: true, message: 'Arrival recorded.' }
    },

    checkout: async (id, late = false) => {
      const reservation = state.reservations.find(r => r.id === id)
      if (!reservation || reservation.status !== 'checked-in') return { ok: false, message: 'Check in before checkout.' }

      if (isSupabaseConfigured) {
        if (!supabase) return { ok: false, message: 'Supabase is not available.' }
        const { data, error } = await supabase.rpc('checkout_parking_reservation', { p_reservation_id: id })
        if (error) return { ok: false, message: error.message }
        const reply = data as { status: string; available_credits: number }
        const isLate = reply.status === 'late'
        const ledger: LedgerEntry = {
          id: uid(), type: isLate ? 'forfeit' : 'release', amount: isLate ? 0 : 25,
          note: isLate ? 'Late checkout: 25 held credits forfeited' : 'On-time checkout: 25 held credits released',
          createdAt: new Date().toISOString(), reservationId: id,
        }
        setState(current => ({
          ...current,
          credits: reply.available_credits,
          reservations: current.reservations.map(r => r.id === id ? { ...r, status: isLate ? 'late' : 'completed' } : r),
          ledger: [ledger, ...current.ledger],
        }))
        return { ok: true, message: isLate ? 'Late checkout recorded; held credits forfeited.' : 'Checkout complete; held credits released.' }
      }

      const entry: LedgerEntry = {
        id: uid(), type: late ? 'forfeit' : 'release', amount: late ? 0 : 25,
        note: late ? 'Demo late checkout: reservation hold forfeited' : 'Demo on-time checkout: reservation hold released',
        createdAt: new Date().toISOString(), reservationId: id,
      }
      setState(current => ({
        ...current,
        credits: late ? current.credits : current.credits + 25,
        reservations: current.reservations.map(r => r.id === id ? { ...r, status: late ? 'late' : 'completed' } : r),
        ledger: [entry, ...current.ledger],
      }))
      return { ok: true, message: late ? 'Demo late checkout simulated; 25 credits forfeited.' : 'Demo checkout complete; 25 credits released.' }
    },

    cancel: async (id) => {
      const reservation = state.reservations.find(r => r.id === id)
      if (!reservation || reservation.status !== 'active') return { ok: false, message: 'Only a not-yet-checked-in reservation can be cancelled.' }
      if (isSupabaseConfigured) {
        if (!supabase) return { ok: false, message: 'Supabase is not available.' }
        const { data, error } = await supabase.rpc('cancel_parking_reservation', { p_reservation_id: id })
        if (error) return { ok: false, message: error.message }
        const reply = data as { available_credits: number }
        setState(current => ({
          ...current,
          credits: reply.available_credits,
          reservations: current.reservations.map(r => r.id === id ? { ...r, status: 'cancelled' } : r),
          ledger: [{
            id: uid(), type: 'release', amount: 25, note: 'Reservation cancelled; 25 credits released',
            createdAt: new Date().toISOString(), reservationId: id,
          }, ...current.ledger],
        }))
        return { ok: true, message: 'Reservation cancelled; credits released.' }
      }
      setState(current => ({
        ...current,
        credits: current.credits + 25,
        reservations: current.reservations.map(r => r.id === id ? { ...r, status: 'cancelled' } : r),
        ledger: [{
          id: uid(), type: 'release', amount: 25, note: 'Demo reservation cancelled; hold released',
          createdAt: new Date().toISOString(), reservationId: id,
        }, ...current.ledger],
      }))
      return { ok: true, message: 'Demo reservation cancelled; credits released.' }
    },

    reset: () => setState(initialState),
  }), [state])

  return <Context.Provider value={api}>{children}</Context.Provider>
}

export function useStore() {
  const value = useContext(Context)
  if (!value) throw new Error('StoreProvider missing')
  return value
}
