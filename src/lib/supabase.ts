import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-application-name': 'ParkSRM' } },
    })
  : null

export const isSupabaseConfigured = Boolean(supabase)

export const SUPABASE_ZONE_IDS: Record<string, string> = {
  north: '00000000-0000-4000-8000-000000000001',
  main: '00000000-0000-4000-8000-000000000002',
  library: '00000000-0000-4000-8000-000000000003',
  hostel: '00000000-0000-4000-8000-000000000004',
}

export function validateSrmEmail(email: string) {
  return /^[^\s@]+@srmist\.edu\.in$/i.test(email.trim())
}

// SRM KTR timetable and reservation times are interpreted in Asia/Kolkata,
// independent of the device's configured timezone.
export function campusTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString()
}
