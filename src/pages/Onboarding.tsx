import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CarFront, MailCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { isSupabaseConfigured, supabase, validateSrmEmail } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/types'

export default function Onboarding() {
  const { saveProfile } = useStore()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('student')
  const [form, setForm] = useState({
    name: '', email: '', department: '', batch: '', registrationId: '',
    designation: '', researchCentre: '', vehicleNumber: '',
    vehicleType: 'two-wheeler' as Profile['vehicleType'],
  })
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!validateSrmEmail(form.email)) {
      setError('Use your institutional @srmist.edu.in email address.')
      return
    }
    if (!form.name.trim() || !form.department.trim() || !form.vehicleNumber.trim()) {
      setError('Complete all required fields.')
      return
    }

    if (!isSupabaseConfigured) {
      saveProfile({ ...form, role })
      navigate('/')
      return
    }

    if (!supabase) return
    setBusy(true)
    try {
      if (!otpSent) {
        const { error: sendError } = await supabase.auth.signInWithOtp({
          email: form.email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        })
        if (sendError) throw sendError
        setOtpSent(true)
        setNotice('A one-time verification code has been sent to your SRM email address.')
        return
      }

      if (!/^\d{6}$/.test(otp.trim())) {
        setError('Enter the six-digit code from your email.')
        return
      }
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: form.email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      })
      if (verifyError) throw verifyError
      if (!authData.user) throw new Error('Email verification did not return an authenticated user.')

      const userId = authData.user.id
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role,
        department: form.department.trim(),
        batch: role === 'student' ? form.batch.trim() || null : null,
        registration_id: role === 'student' ? form.registrationId.trim() || null : null,
        designation: role === 'faculty' ? form.designation.trim() || null : null,
        research_centre: role === 'researcher' ? form.researchCentre.trim() || null : null,
      }, { onConflict: 'id' })
      if (profileError) throw profileError

      const { data: wallet, error: walletError } = await supabase.from('wallets')
        .select('available_credits').eq('user_id', userId).single()
      if (walletError) throw walletError

      const { data: vehicle, error: vehicleError } = await supabase.from('vehicles').upsert({
        user_id: userId,
        registration_number: form.vehicleNumber.trim().toUpperCase(),
        vehicle_type: form.vehicleType,
      }, { onConflict: 'registration_number' }).select('id').single()
      if (vehicleError) throw vehicleError

      saveProfile({
        ...form,
        role,
        email: form.email.trim().toLowerCase(),
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        backendUserId: userId,
        backendVehicleId: vehicle.id,
        backendAvailableCredits: wallet.available_credits,
      })
      navigate('/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete profile setup.')
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: form.email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (sendError) throw sendError
      setNotice('A fresh verification code has been sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the code.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="onboarding">
    <div className="onboarding-brand"><div className="brand-mark"><CarFront/></div><b>ParkSRM</b></div>
    <div className="onboarding-card">
      <div className="eyebrow">SRMIST · KTR CAMPUS</div>
      <h1>Make campus parking<br/>work around you.</h1>
      <p>Set up your profile to explore timetable-aware parking.</p>

      {!isSupabaseConfigured && <button type="button" className="secondary-btn demo-fill" onClick={() => setForm({
        name: 'Demo Student', email: 'demo.student@srmist.edu.in',
        department: 'Computer Science and Engineering', batch: '2023–2027',
        registrationId: 'DEMO2027', designation: '', researchCentre: '',
        vehicleNumber: 'TN 00 XX 2027', vehicleType: 'two-wheeler',
      })}>Fill sample student profile</button>}

      <form onSubmit={submit}>
        <label className="field-label">I am a
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} disabled={otpSent}>
            <option value="student">Student</option>
            <option value="faculty">Faculty member</option>
            <option value="researcher">Researcher / scholar</option>
          </select>
        </label>
        <div className="form-grid two">
          <label className="field-label">Full name<input required value={form.name} disabled={otpSent} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name"/></label>
          <label className="field-label">SRM email<input required type="email" value={form.email} disabled={otpSent} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@srmist.edu.in"/></label>
          <label className="field-label">Department / school<input required value={form.department} disabled={otpSent} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Department name"/></label>
          {role === 'student' ? <>
            <label className="field-label">Batch / graduation year<input value={form.batch} disabled={otpSent} onChange={e => setForm({ ...form, batch: e.target.value })} placeholder="e.g. 2023–2027"/></label>
            <label className="field-label">Registration number<input value={form.registrationId} disabled={otpSent} onChange={e => setForm({ ...form, registrationId: e.target.value })} placeholder="SRM registration ID"/></label>
          </> : <>
            <label className="field-label">{role === 'faculty' ? 'Designation' : 'Research centre'}
              <input value={role === 'faculty' ? form.designation : form.researchCentre} disabled={otpSent}
                onChange={e => setForm({ ...form, [role === 'faculty' ? 'designation' : 'researchCentre']: e.target.value })}
                placeholder="Enter details"/>
            </label>
          </>}
          <label className="field-label">Vehicle registration<input required value={form.vehicleNumber} disabled={otpSent} onChange={e => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} placeholder="TN 00 AA 0000"/></label>
          <label className="field-label">Vehicle type<select value={form.vehicleType} disabled={otpSent} onChange={e => setForm({ ...form, vehicleType: e.target.value as Profile['vehicleType'] })}><option value="two-wheeler">Two-wheeler</option><option value="four-wheeler">Four-wheeler</option></select></label>
        </div>

        {otpSent && <label className="field-label otp-field">Email verification code
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"/>
        </label>}
        {error && <div className="form-error">{error}</div>}
        {notice && <div className="notice success"><MailCheck size={15}/> {notice}</div>}
        <button className="primary-btn full-btn" disabled={busy}>
          {busy ? 'Please wait…' : isSupabaseConfigured ? (otpSent ? 'Verify email & create profile' : 'Send verification code') : 'Create demo profile'}
          <ArrowRight size={16}/>
        </button>
        {otpSent && <button type="button" className="ghost-btn resend-code" disabled={busy} onClick={resendCode}>Resend code</button>}
        <small className="form-disclaimer">
          {isSupabaseConfigured
            ? 'Supabase email OTP verifies address ownership. Institutional eligibility and any live parking operation still require SRM approval.'
            : 'Local demo profile only. It is not authenticated and does not verify institutional email ownership.'}
        </small>
      </form>
    </div>
  </div>
}
