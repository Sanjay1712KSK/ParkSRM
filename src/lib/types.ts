export type UserRole = 'student' | 'faculty' | 'researcher'
export type TimetableSession = { id: string; day: string; start: string; end: string; course: string; location?: string }
export type Profile = {
  name: string; email: string; role: UserRole; department: string
  batch?: string; registrationId?: string; designation?: string; researchCentre?: string
  vehicleNumber: string; vehicleType: 'two-wheeler' | 'four-wheeler'
  backendUserId?: string; backendVehicleId?: string; backendAvailableCredits?: number
}
export type ParkingZone = { id: string; name: string; area: string; total: number; occupied: number; vehicleTypes: string[] }
export type Reservation = {
  id: string; zoneId: string; slotLabel: string; date: string; start: string; end: string
  graceEnd: string; status: 'active' | 'checked-in' | 'completed' | 'late' | 'cancelled'
  createdAt: string; creditsHeld: number
}
export type LedgerEntry = { id: string; type: 'hold' | 'release' | 'forfeit' | 'adjustment'; amount: number; note: string; createdAt: string; reservationId?: string }
export type AppState = {
  profile: Profile | null; zones: ParkingZone[]; timetable: TimetableSession[]
  reservations: Reservation[]; ledger: LedgerEntry[]; credits: number; onboardingComplete: boolean
}
