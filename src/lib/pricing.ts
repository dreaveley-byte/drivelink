export type PricingSettings = {
  hourly_rate_cents: number
  fuel_price_cents_per_litre: number
  fuel_economy_driven_l_per_100km: number
  fuel_economy_towed_l_per_100km: number
  hotel_rate_cents: number
  overnight_fee_cents: number
  wear_and_tear_cents_per_km: number
  trailer_fee_cents_per_day: number
  meal_allowance_cents: number
  meal_allowance_every_hours: number
  meal_allowance_max_count: number
  dealer_markup_percent: number
  out_of_province_inspection_min_hours: number
  registry_visit_min_hours: number
  max_driving_hours_before_overnight: number
}

export type AdditionalCharge = {
  description: string
  dealerAmountCents: number
  hoursAdded: number
  paidToDriver: boolean
}

export type PricingInput = {
  distanceKm: number // one-way, from Google
  durationMinutes: number // one-way, from Google
  vehicleMode: 'driven' | 'towed'
  numDrivers: 1 | 2
  usedOwnVehicle: boolean
  outOfProvinceInspection: boolean
  registryVisit: boolean
  additionalCharges: AdditionalCharge[]
}

export type PricingResult = {
  overnightRequired: boolean
  baseDrivingHours: number
  dealerBilledHours: number
  driverPaidHours: number
  gasCostCents: number
  mealCostCents: number
  wearAndTearCents: number
  trailerFeeCents: number
  hotelCents: number
  overnightFeeCents: number
  hourlyDealerCents: number
  hourlyDriverCents: number
  extrasDealerCents: number
  extrasDriverCents: number
  costBasisCents: number // everything before markup
  estimatedDealerCostCents: number // costBasis × markup
  estimatedDriverPayCents: number
}

export function calculatePricing(input: PricingInput, settings: PricingSettings): PricingResult {
  const {
    distanceKm, durationMinutes, vehicleMode, numDrivers,
    usedOwnVehicle, outOfProvinceInspection, registryVisit, additionalCharges,
  } = input

  // Towed jobs are round-trip (the trailer has to come back); driven jobs are one-way,
  // with any return travel handled separately via additional charges (flight, Uber, etc.)
  const tripDistanceKm = vehicleMode === 'towed' ? distanceKm * 2 : distanceKm
  const baseDrivingHours = (vehicleMode === 'towed' ? durationMinutes * 2 : durationMinutes) / 60

  const overnightRequired = baseDrivingHours > settings.max_driving_hours_before_overnight

  // Extra fixed-minimum hours (billed to dealer, not paid to driver — not "real hours worked")
  const inspectionHours = outOfProvinceInspection ? settings.out_of_province_inspection_min_hours : 0
  const registryHours = registryVisit ? settings.registry_visit_min_hours : 0

  const extraDriverPaidHours = additionalCharges
    .filter((c) => c.paidToDriver)
    .reduce((sum, c) => sum + c.hoursAdded, 0)
  const extraDealerOnlyHours = additionalCharges
    .reduce((sum, c) => sum + c.hoursAdded, 0)

  const dealerBilledHours = baseDrivingHours + inspectionHours + registryHours + extraDealerOnlyHours
  const driverPaidHours = baseDrivingHours + extraDriverPaidHours

  const hourlyDealerCents = Math.round(dealerBilledHours * settings.hourly_rate_cents * numDrivers)
  const hourlyDriverCents = Math.round(driverPaidHours * settings.hourly_rate_cents * numDrivers)

  const fuelEconomy = vehicleMode === 'towed'
    ? settings.fuel_economy_towed_l_per_100km
    : settings.fuel_economy_driven_l_per_100km
  const gasCostCents = Math.round((tripDistanceKm / 100) * fuelEconomy * settings.fuel_price_cents_per_litre)

  const mealBreaks = Math.min(
    Math.floor(baseDrivingHours / settings.meal_allowance_every_hours),
    settings.meal_allowance_max_count
  )
  const mealCostCents = mealBreaks * settings.meal_allowance_cents * numDrivers

  const wearAndTearCents = usedOwnVehicle
    ? Math.round(distanceKm * settings.wear_and_tear_cents_per_km)
    : 0

  const trailerDays = overnightRequired ? 2 : 1
  const trailerFeeCents = vehicleMode === 'towed' ? trailerDays * settings.trailer_fee_cents_per_day : 0

  const hotelCents = overnightRequired ? settings.hotel_rate_cents : 0
  const overnightFeeCents = overnightRequired ? settings.overnight_fee_cents * numDrivers : 0

  const extrasDealerCents = additionalCharges.reduce((sum, c) => sum + c.dealerAmountCents, 0)
  const extrasDriverCents = additionalCharges
    .filter((c) => c.paidToDriver)
    .reduce((sum, c) => sum + c.dealerAmountCents, 0)

  const costBasisCents =
    hourlyDealerCents + gasCostCents + mealCostCents + wearAndTearCents +
    trailerFeeCents + hotelCents + overnightFeeCents + extrasDealerCents

  const estimatedDealerCostCents = Math.round(costBasisCents * (settings.dealer_markup_percent / 100))

  const estimatedDriverPayCents =
    hourlyDriverCents + mealCostCents + wearAndTearCents + overnightFeeCents + extrasDriverCents

  return {
    overnightRequired,
    baseDrivingHours,
    dealerBilledHours,
    driverPaidHours,
    gasCostCents,
    mealCostCents,
    wearAndTearCents,
    trailerFeeCents,
    hotelCents,
    overnightFeeCents,
    hourlyDealerCents,
    hourlyDriverCents,
    extrasDealerCents,
    extrasDriverCents,
    costBasisCents,
    estimatedDealerCostCents,
    estimatedDriverPayCents,
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
