/**
 * Delivery time slots: 1-hour windows from 9 AM to 6 PM only.
 * If current time > 6 PM, today shows no slots; next day slots run 9 AM–6 PM.
 * Used in "Choose a Shop delivery Time" step.
 */

const SLOT_DURATION_MINUTES = 60
const WINDOW_START_HOUR = 9  // 9 AM
const WINDOW_END_HOUR = 18   // 6 PM (last slot starts at 5 PM, ends at 6 PM)
const DELIVERY_FEE_CENTS = 999 // $9.99
const SLOTS_LEFT_DEFAULT = 4

/** Number of 1-hour slots from 9 AM to 6 PM (9, 10, 11, 12, 1, 2, 3, 4, 5 = 9 slots) */
const SLOTS_PER_DAY = WINDOW_END_HOUR - WINDOW_START_HOUR

export type DeliveryTimeSlot = {
  id: string
  date: Date
  startTime: string // "7:00am"
  endTime: string   // "8:00am"
  label: string     // "7:00am - 8:00am"
  dateLabel: string // "Fri Feb 20"
  priceCents: number
  slotsLeft: number
  isAvailable: boolean
}

function formatTime(d: Date): string {
  const hours = d.getHours()
  const mins = d.getMinutes()
  const am = hours < 12
  const h = hours % 12 || 12
  const m = mins.toString().padStart(2, "0")
  return `${h}:${m}${am ? "am" : "pm"}`
}

function formatDateLabel(d: Date, isToday: boolean): string {
  if (isToday) return `Today ${formatShortDate(d)}`
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const month = d.toLocaleString("en-US", { month: "short" })
  return `${days[d.getDay()]} ${month} ${d.getDate()}`
}

function formatShortDate(d: Date): string {
  const month = d.toLocaleString("en-US", { month: "short" })
  return `${month} ${d.getDate()}`
}

function toDateKey(d: Date): string {
  return d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, "0") + "-" + d.getDate().toString().padStart(2, "0")
}

/**
 * True if the given date is today and current time is at or after 6 PM (no slots left today).
 */
export function isTodayNoSlotsAvailable(date: Date): boolean {
  const now = new Date()
  if (
    now.getDate() !== date.getDate() ||
    now.getMonth() !== date.getMonth() ||
    now.getFullYear() !== date.getFullYear()
  ) {
    return false
  }
  return now.getHours() >= WINDOW_END_HOUR
}

/**
 * Build slots for a given day: 1-hour slots from 9 AM to 6 PM only.
 * Today: if current time >= 6 PM, return []; else first slot is next full hour from now (or 9 AM if before 9 AM).
 * Future days: all 9 slots from 9 AM to 6 PM.
 */
function getSlotsForDay(
  dayStart: Date,
  now: Date,
  showOnlyAvailable: boolean
): DeliveryTimeSlot[] {
  const dayKey = toDateKey(dayStart)
  const isToday =
    dayStart.getDate() === now.getDate() &&
    dayStart.getMonth() === now.getMonth() &&
    dayStart.getFullYear() === now.getFullYear()

  if (isToday && now.getHours() >= WINDOW_END_HOUR) {
    return []
  }

  const slots: DeliveryTimeSlot[] = []
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const slotStartHour = WINDOW_START_HOUR + i
    const slotStart = new Date(dayStart)
    slotStart.setHours(slotStartHour, 0, 0, 0)
    const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000)

    if (isToday) {
      if (slotEnd <= now) continue
      const nextFullHour = new Date(now)
      nextFullHour.setMinutes(0, 0, 0)
      if (now.getMinutes() > 0) nextFullHour.setHours(nextFullHour.getHours() + 1, 0, 0, 0)
      if (slotStart < nextFullHour) continue
    }

    const isAvailable = !isToday || slotStart >= now
    if (showOnlyAvailable && !isAvailable) continue

    const startTime = formatTime(slotStart)
    const endTime = formatTime(slotEnd)
    const id = `${dayKey}-${slotStart.getHours()}-${slotStart.getMinutes()}`
    slots.push({
      id,
      date: new Date(slotStart),
      startTime,
      endTime,
      label: `${startTime} - ${endTime}`,
      dateLabel: formatDateLabel(dayStart, isToday),
      priceCents: DELIVERY_FEE_CENTS,
      slotsLeft: SLOTS_LEFT_DEFAULT,
      isAvailable,
    })
  }
  return slots
}

export type DayOption = {
  date: Date
  label: string
  dateKey: string
}

const DAYS_AHEAD = 7

/**
 * Returns the next DAYS_AHEAD days for the date picker (including today).
 */
export function getDeliveryDayOptions(): DayOption[] {
  const now = new Date()
  const options: DayOption[] = []
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const isToday = i === 0
    options.push({
      date: d,
      label: formatDateLabel(d, isToday),
      dateKey: toDateKey(d),
    })
  }
  return options
}

/**
 * Returns time slots for the given date. 1-hour slots from 9 AM to 6 PM only.
 * Today after 6 PM returns []. On future days returns all 9 slots (9am–6pm).
 */
export function getDeliveryTimeSlotsForDate(
  date: Date,
  showOnlyAvailable: boolean
): DeliveryTimeSlot[] {
  const now = new Date()
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  return getSlotsForDay(dayStart, now, showOnlyAvailable)
}

export function formatSlotPrice(cents: number): string {
  return "$" + (cents / 100).toFixed(2)
}

export const RESERVATION_HOLD_HOURS = 2
export const RESERVATION_WARNING_MINUTES = 119 // 1 hour 59 minutes
