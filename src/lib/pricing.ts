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
  minimum_driver_pay_cents: number
  out_of_province_inspection_min_hours: number
  out_of_province_inspection_fee_cents: number
  registry_visit_min_hours: number
  registry_visit_fee_cents: number
  max_driving_hours_before_overnight: number
  return_ground_transport_hours: number
  return_ground_transport_fee_cents: number
  uber_base_fare_cents: number
  uber_per_km_cents: number
  uber_minimum_fare_cents: number
  flight_airport_buffer_hours: number
  break_duration_minutes: number
  ferry_fare_cents: number
  ferry_wait_hours: number
  ferry_walkon_fare_cents: number
  bus_base_fare_cents: number
  bus_per_km_cents: number
}

export type AdditionalCharge = {
  description: string
  dealerAmountCents: number
  hoursAdded: number
  paidToDriver: boolean
  // Stable tag for auto-generated charges, so cleanup/lookup code can identify
  // them reliably instead of matching on description text (which changes over
  // time and silently breaks that matching). Manual/user-added charges omit this.
  kind?: 'flight' | 'ferry' | 'bus' | 'ground-to-airport' | 'ground-home'
}

export type PricingInput = {
  distanceKm: number // one-way, from Google
  durationMinutes: number // one-way, from Google
  vehicleMode: 'driven' | 'towed'
  numDrivers: 1 | 2
  outOfProvinceInspection: boolean
  registryVisit: boolean
  ferryRequired: boolean
  additionalCharges: AdditionalCharge[]
  oneWayFlightBack: boolean // driver flies back instead of driving back — bill/pay one-way only
}

export type PricingResult = {
  overnightRequired: boolean
  oneWayFlightBack: boolean
  tripDistanceKm: number
  baseDrivingHours: number
  breakHours: number
  dealerBilledHours: number
  driverPaidHours: number
  gasCostCents: number
  mealCostCents: number
  wearAndTearCents: number
  trailerFeeCents: number
  hotelCents: number
  overnightFeeCents: number
  inspectionFeeCents: number
  registryFeeCents: number
  ferryFeeCents: number
  hourlyDealerCents: number
  hourlyDriverCents: number
  extrasDealerCents: number
  reimbursementCents: number
  costBasisCents: number // everything before markup
  estimatedDealerCostCents: number // costBasis × markup
  estimatedDriverPayCents: number
}

export function calculatePricing(input: PricingInput, settings: PricingSettings): PricingResult {
  const {
    distanceKm, durationMinutes, vehicleMode, numDrivers,
    outOfProvinceInspection, registryVisit, ferryRequired, additionalCharges: rawAdditionalCharges, oneWayFlightBack,
  } = input

  // Safety net: a single corrupted charge (bad data, a stale entry, anything
  // that ends up NaN/non-finite) should never be able to wipe out the entire
  // quote by poisoning every sum downstream. Sanitize once, up front.
  const additionalCharges = rawAdditionalCharges.map((c) => ({
    ...c,
    dealerAmountCents: Number.isFinite(c.dealerAmountCents) ? c.dealerAmountCents : 0,
    hoursAdded: Number.isFinite(c.hoursAdded) ? c.hoursAdded : 0,
  }))

  // Normally every delivery is a round trip — the driver (and trailer, if towing)
  // has to drive back. If the driver is flying back instead, only bill/pay for
  // the one-way drive; the flight itself gets added as a flat charge below.
  const tripDistanceKm = oneWayFlightBack ? distanceKm : distanceKm * 2
  const baseDrivingHours = oneWayFlightBack ? durationMinutes / 60 : (durationMinutes * 2) / 60

  // Extra fixed-minimum hours (billed to dealer, not paid to driver — not "real hours worked")
  const inspectionHours = outOfProvinceInspection ? settings.out_of_province_inspection_min_hours : 0
  const registryHours = registryVisit ? settings.registry_visit_min_hours : 0
  // Ferry wait buffer — BC Ferries recommends arriving well before sailing time,
  // and Google's drive time doesn't reliably account for that wait or the fare.
  // On a round trip (not flying back), the driver crosses the water twice.
  const ferryCrossings = oneWayFlightBack ? 1 : 2
  const ferryHours = ferryRequired ? settings.ferry_wait_hours * ferryCrossings : 0
  const ferryFeeCents = ferryRequired ? settings.ferry_fare_cents * ferryCrossings : 0

  // Every meal break also costs real time on the road (bathroom, gas, food) —
  // not just the meal allowance dollars. Same cadence, two effects.
  const mealBreaks = Math.min(
    Math.floor(baseDrivingHours / settings.meal_allowance_every_hours),
    settings.meal_allowance_max_count
  )
  const mealCostCents = mealBreaks * settings.meal_allowance_cents * numDrivers
  const breakHours = (mealBreaks * settings.break_duration_minutes) / 60

  // Overnight isn't just about drive time — the inspection/registry stops, ferry
  // wait, and break time add real hours on the ground too, and together they can
  // push the driver past the point where they can safely finish same-day.
  const overnightRequired =
    baseDrivingHours + breakHours + inspectionHours + registryHours + ferryHours > settings.max_driving_hours_before_overnight

  // Hours always represent real time the driver spent working (driving, flying,
  // waiting at the airport, etc.) so they're always paid — separate from whether
  // the dealerAmountCents dollar figure also gets reimbursed to the driver.
  // (e.g. a flight ticket: the driver is paid for the hours spent traveling,
  // but the ticket cost itself is billed to the dealer only, not added to pay.)
  const extraDriverPaidHours = additionalCharges.reduce((sum, c) => sum + c.hoursAdded, 0)
  const extraDealerOnlyHours = additionalCharges
    .reduce((sum, c) => sum + c.hoursAdded, 0)

  const dealerBilledHours = baseDrivingHours + breakHours + inspectionHours + registryHours + ferryHours + extraDealerOnlyHours
  const driverPaidHours = baseDrivingHours + breakHours + extraDriverPaidHours

  const hourlyDealerCents = Math.round(dealerBilledHours * settings.hourly_rate_cents * numDrivers)
  const hourlyDriverCents = Math.round(driverPaidHours * settings.hourly_rate_cents * numDrivers)

  const fuelEconomy = vehicleMode === 'towed'
    ? settings.fuel_economy_towed_l_per_100km
    : settings.fuel_economy_driven_l_per_100km
  // Second driver means a second vehicle (the chase vehicle) covering the same distance —
  // so fuel gets charged per vehicle, same as hourly pay is charged per driver.
  const gasCostCents = Math.round((tripDistanceKm / 100) * fuelEconomy * settings.fuel_price_cents_per_litre) * numDrivers

  // Wear & tear only applies when the driver uses their own vehicle to do the job —
  // that's only true for towed jobs (their own truck pulling the trailer). On a
  // "driven" job the driver is driving the dealer's vehicle itself, not their own.
  const wearAndTearCents = vehicleMode === 'towed'
    ? Math.round(tripDistanceKm * settings.wear_and_tear_cents_per_km)
    : 0

  const trailerDays = overnightRequired ? 2 : 1
  const trailerFeeCents = vehicleMode === 'towed' ? trailerDays * settings.trailer_fee_cents_per_day : 0

  const hotelCents = overnightRequired ? settings.hotel_rate_cents : 0
  const overnightFeeCents = overnightRequired ? settings.overnight_fee_cents * numDrivers : 0

  // Flat service fees on top of the hourly-minimum time already billed above —
  // dealer-only, not paid to the driver (same treatment as hotel).
  const inspectionFeeCents = outOfProvinceInspection ? settings.out_of_province_inspection_fee_cents : 0
  const registryFeeCents = registryVisit ? settings.registry_visit_fee_cents : 0

  const extrasDealerCents = additionalCharges.reduce((sum, c) => sum + c.dealerAmountCents, 0)
  // Reimbursements (e.g. Uber/bus the driver paid for out of pocket) are tracked
  // separately from pay — they're money owed back for real costs, not wages.
  const reimbursementCents = additionalCharges
    .filter((c) => c.paidToDriver)
    .reduce((sum, c) => sum + c.dealerAmountCents, 0)

  // Guarantee a minimum total payout per job, regardless of how short the trip is.
  // Reimbursements are intentionally excluded — the floor is about fair pay for
  // time worked, not about the size of an unrelated expense reimbursement.
  const computedDriverPayCents = hourlyDriverCents + mealCostCents + wearAndTearCents + overnightFeeCents
  const estimatedDriverPayCents = Math.max(computedDriverPayCents, settings.minimum_driver_pay_cents)
  // If the floor kicked in, the dealer's cost basis needs to cover that extra amount
  // too, before markup is applied on top.
  const driverPayFloorBumpCents = estimatedDriverPayCents - computedDriverPayCents

  const costBasisCents =
    hourlyDealerCents + gasCostCents + mealCostCents + wearAndTearCents +
    trailerFeeCents + hotelCents + overnightFeeCents + inspectionFeeCents +
    registryFeeCents + ferryFeeCents + extrasDealerCents + driverPayFloorBumpCents

  const estimatedDealerCostCents = Math.round(costBasisCents * (settings.dealer_markup_percent / 100))

  return {
    overnightRequired,
    oneWayFlightBack,
    tripDistanceKm,
    baseDrivingHours,
    breakHours,
    dealerBilledHours,
    driverPaidHours,
    gasCostCents,
    mealCostCents,
    wearAndTearCents,
    trailerFeeCents,
    hotelCents,
    overnightFeeCents,
    inspectionFeeCents,
    registryFeeCents,
    ferryFeeCents,
    hourlyDealerCents,
    hourlyDriverCents,
    extrasDealerCents,
    reimbursementCents,
    costBasisCents,
    estimatedDealerCostCents,
    estimatedDriverPayCents,
  }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
