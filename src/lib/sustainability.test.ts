import { describe, expect, it } from 'vitest'
import { estimateMobilityImpact, PETROL_CO2_KG_PER_LITRE } from './sustainability'

describe('estimateMobilityImpact', () => {
  it('calculates the default 100-booking demonstration scenario', () => {
    const result = estimateMobilityImpact({
      baselineSearchKm: 1.2,
      optimizedSearchKm: 0.3,
      vehicleEfficiencyKmPerLitre: 12,
      bookings: 100,
    })
    expect(result.avoidedKm).toBeCloseTo(0.9)
    expect(result.fleetKm).toBeCloseTo(90)
    expect(result.fleetLitres).toBeCloseTo(7.5)
    expect(result.fleetCo2).toBeCloseTo(17.325)
  })

  it('never reports negative avoided distance', () => {
    const result = estimateMobilityImpact({
      baselineSearchKm: 0.5,
      optimizedSearchKm: 1.2,
      vehicleEfficiencyKmPerLitre: 12,
      bookings: 10,
    })
    expect(result.avoidedKm).toBe(0)
    expect(result.fleetCo2).toBe(0)
  })

  it('rejects invalid fuel efficiency', () => {
    expect(() => estimateMobilityImpact({
      baselineSearchKm: 1,
      optimizedSearchKm: 0,
      vehicleEfficiencyKmPerLitre: 0,
      bookings: 1,
    })).toThrow('Vehicle efficiency must be greater than zero.')
  })

  it('uses the documented petrol reference factor', () => {
    expect(PETROL_CO2_KG_PER_LITRE).toBe(2.31)
  })
})
