export const PETROL_CO2_KG_PER_LITRE = 2.31

export type MobilityImpactInput = {
  baselineSearchKm: number
  optimizedSearchKm: number
  vehicleEfficiencyKmPerLitre: number
  bookings: number
}

export function estimateMobilityImpact(input: MobilityImpactInput) {
  const { baselineSearchKm, optimizedSearchKm, vehicleEfficiencyKmPerLitre, bookings } = input
  const values = [baselineSearchKm, optimizedSearchKm, vehicleEfficiencyKmPerLitre, bookings]
  if (values.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Impact assumptions must be finite, non-negative numbers.')
  }
  if (vehicleEfficiencyKmPerLitre <= 0) {
    throw new Error('Vehicle efficiency must be greater than zero.')
  }

  const avoidedKm = Math.max(0, baselineSearchKm - optimizedSearchKm)
  const litres = avoidedKm / vehicleEfficiencyKmPerLitre
  const co2Kg = litres * PETROL_CO2_KG_PER_LITRE
  return {
    avoidedKm,
    litres,
    co2Kg,
    fleetKm: avoidedKm * bookings,
    fleetCo2: co2Kg * bookings,
    fleetLitres: litres * bookings,
  }
}
