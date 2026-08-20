export type PricingSettings = {
  hourly_rate_cents: number
  simple_job_hourly_rate_cents: number
  fuel_price_cents_per_litre: number
  delivery_handling_buffer_hours: number
  bus_terminal_buffer_hours: number
  bus_max_distance_km: number
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
  customer_pickup_dropoff_markup_percent: number
  minimum_driver_pay_cents: number
  simple_job_minimum_pay_cents: number
  out_of_province_inspection_min_hours: number
  out_of_province_inspection_fee_cents: number
  registry_visit_min_hours: number
  registry_visit_fee_cents: number
  insurance_visit_min_hours: number
  insurance_visit_fee_cents: number
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
  garage_insurance_fee_cents: number
  drivflo_insurance_rate_per_day_cents: number
  drivflo_insurance_multiday_discount_percent: number
  drivflo_insurance_tow_deductible_fee_cents: number
  max_daily_meal_budget_cents: number
  bus_base_fare_cents: number
  bus_per_km_cents: number
  job_review_hold_minutes: number
  job_review_hold_min_distance_km: number
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
  numDrivers: number
  outOfProvinceInspection: boolean
  registryVisit: boolean
  insuranceVisit: boolean
  markupPercentOverride?: number | null
  useSimpleJobRates?: boolean
  ferryRequired: boolean
  useGarageInsurance: boolean
  includeTowDeductibleCoverage: boolean
  additionalCharges: AdditionalCharge[]
  oneWayFlightBack: boolean // driver flies back instead of driving back — bill/pay one-way only
  // For linked multi-vehicle deals (e.g. 2 trade-ins + 1 purchase): how many
  // vehicles actually use fuel on each leg. Defaults to numDrivers for both
  // legs when omitted, matching the normal (non-linked) behavior.
  outboundVehicleCount?: number
  returnVehicleCount?: number
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
  garageInsuranceFeeCents: number
  insuranceDays: number
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
    outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: rawAdditionalCharges, oneWayFlightBack, markupPercentOverride, useSimpleJobRates,
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
  const insuranceHours = insuranceVisit ? settings.insurance_visit_min_hours : 0
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
  const breakHours = (mealBreaks * settings.break_duration_minutes) / 60

  // Hours always represent real time the driver spent working (driving, flying,
  // waiting at the airport, etc.) so they're always paid — separate from whether
  // the dealerAmountCents dollar figure also gets reimbursed to the driver.
  // (e.g. a flight ticket: the driver is paid for the hours spent traveling,
  // but the ticket cost itself is billed to the dealer only, not added to pay.)
  const extraDealerOnlyHours = additionalCharges.reduce((sum, c) => sum + c.hoursAdded, 0)

  // Overnight isn't just about drive time — the inspection/registry stops, ferry
  // wait, break time, and (crucially, for a fly-back job) the flight itself plus
  // its ground-transport/check-in-buffer hours all add real time to the driver's
  // day, and together they can push the driver past the point where they can
  // safely finish same-day. This must include extraDealerOnlyHours (the flight/
  // ground-transport/ferry charge hours already computed above) — a job that's
  // only long because of a late flight and a multi-hour buffer, not the drive
  // itself, still needs a hotel and the overnight fee just as much as one that's
  // long from driving alone. Previously this was computed before those extra
  // hours existed, so a long fly-back day silently never triggered overnight.
  const overnightRequired =
    baseDrivingHours + breakHours + inspectionHours + registryHours + insuranceHours + ferryHours + extraDealerOnlyHours > settings.max_driving_hours_before_overnight

  // Capped per person per day — an overnight trip is treated as 2 days for this
  // purpose (the app's overnight model is a single same-day/next-day threshold,
  // not a full multi-night calendar).
  //
  // `mealBreaks` only counts meal stops taken during the driving portion of
  // the trip — on an overnight job the driver is still away (and still needs
  // to eat) on the second day even if no further "driving break" happens
  // there (e.g. an early return flight, or a short final leg). Previously
  // `mealDays` only widened the cap without ever actually scaling the dollar
  // total for that second day, so a long overnight trip with few driving-break
  // meals on day one could end up with a meal budget barely covering a single
  // day despite the driver being out for two. Cap per day first (matching
  // what `max_daily_meal_budget_cents` actually means), then multiply by the
  // number of days the driver is out.
  const perDayMealCostCents = Number.isFinite(settings.max_daily_meal_budget_cents)
    ? Math.min(mealBreaks * settings.meal_allowance_cents, settings.max_daily_meal_budget_cents)
    : mealBreaks * settings.meal_allowance_cents
  const mealDays = overnightRequired ? 2 : 1
  const mealCostCents = perDayMealCostCents * mealDays * numDrivers

  // Every delivery involves real time at the destination beyond pure driving —
  // paperwork, the walkaround, signatures, handing over keys. This wasn't
  // accounted for anywhere before; it's a small flat addition applied to every
  // job, not just long-haul ones, since it's real time on every single delivery.
  const deliveryHandlingHours = settings.delivery_handling_buffer_hours

  const dealerBilledHours = baseDrivingHours + breakHours + inspectionHours + registryHours + insuranceHours + ferryHours + extraDealerOnlyHours + deliveryHandlingHours
  // The driver is paid hourly for every hour the dealer is billed for — the
  // inspection/registry/insurance/ferry wait time is real time the driver
  // spends on the job, even though the dealer's flat inspection/registry fee
  // dollars themselves stay dealer-only (that fee covers the shop/registry
  // cost, not the driver's time — the driver's time is compensated through
  // the hourly rate instead). Previously this excluded that wait time
  // entirely, so a driver could sit through a 2-hour inspection and 30-minute
  // registry stop and get paid for neither. Driver hours now equal dealer
  // hours exactly; the only place they diverge in dollar terms is the dealer
  // markup applied on top of the dealer's total afterward, which the driver
  // never sees a share of.
  const driverPaidHours = dealerBilledHours

  const effectiveHourlyRateCents = useSimpleJobRates ? settings.simple_job_hourly_rate_cents : settings.hourly_rate_cents
  const hourlyDealerCents = Math.round(dealerBilledHours * effectiveHourlyRateCents * numDrivers)
  const hourlyDriverCents = Math.round(driverPaidHours * effectiveHourlyRateCents * numDrivers)

  const fuelEconomy = vehicleMode === 'towed'
    ? settings.fuel_economy_towed_l_per_100km
    : settings.fuel_economy_driven_l_per_100km
  // Normally both legs use the same number of vehicles (numDrivers — e.g. a
  // chase vehicle follows the whole way). For a linked multi-vehicle deal
  // (2 trade-ins + 1 purchase, or 2 purchases + 1 trade-in), one leg only
  // needs fuel for 1 vehicle while the other needs 2 — outboundVehicleCount/
  // returnVehicleCount let the caller override that per leg.
  const outboundVehicles = input.outboundVehicleCount ?? numDrivers
  const returnVehicles = oneWayFlightBack ? 0 : (input.returnVehicleCount ?? numDrivers)
  const perLegGasCents = Math.round((distanceKm / 100) * fuelEconomy * settings.fuel_price_cents_per_litre)
  const gasCostCents = perLegGasCents * outboundVehicles + perLegGasCents * returnVehicles

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
  const effectiveMinimumPayCents = useSimpleJobRates ? settings.simple_job_minimum_pay_cents : settings.minimum_driver_pay_cents
  const estimatedDriverPayCents = Math.max(computedDriverPayCents, effectiveMinimumPayCents)
  // If the floor kicked in, the dealer's cost basis needs to cover that extra amount
  // too, before markup is applied on top.
  const driverPayFloorBumpCents = estimatedDriverPayCents - computedDriverPayCents

  // Drivflo's own insurance is priced per vehicle per day — day 1 at full rate,
  // every day after that discounted (the vehicle's tied up longer, but the
  // marginal risk/cost of continuing coverage is lower than starting fresh).
  // Days are estimated from total billed hours since the app doesn't track a
  // precise multi-night calendar.
  const insuranceDays = Math.max(1, Math.ceil(dealerBilledHours / 24))
  const discountedDailyRateCents = Number.isFinite(settings.drivflo_insurance_rate_per_day_cents) && Number.isFinite(settings.drivflo_insurance_multiday_discount_percent)
    ? Math.round(settings.drivflo_insurance_rate_per_day_cents * (1 - settings.drivflo_insurance_multiday_discount_percent / 100))
    : 0
  const baseInsuranceCents = Number.isFinite(settings.drivflo_insurance_rate_per_day_cents)
    ? settings.drivflo_insurance_rate_per_day_cents + Math.max(0, insuranceDays - 1) * discountedDailyRateCents
    : 0
  const towDeductibleCents =
    includeTowDeductibleCoverage && Number.isFinite(settings.drivflo_insurance_tow_deductible_fee_cents)
      ? settings.drivflo_insurance_tow_deductible_fee_cents
      : 0
  const garageInsuranceFeeCents = useGarageInsurance ? baseInsuranceCents + towDeductibleCents : 0

  const costBasisCents =
    hourlyDealerCents + gasCostCents + mealCostCents + wearAndTearCents +
    trailerFeeCents + hotelCents + overnightFeeCents + inspectionFeeCents +
    registryFeeCents + ferryFeeCents + garageInsuranceFeeCents + extrasDealerCents + driverPayFloorBumpCents

  const effectiveMarkupPercent = markupPercentOverride != null ? markupPercentOverride : settings.dealer_markup_percent
  const estimatedDealerCostCents = Math.round(costBasisCents * (effectiveMarkupPercent / 100))

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
    garageInsuranceFeeCents,
    insuranceDays,
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
