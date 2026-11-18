/** Date helpers shared by the Social Studio server and client. All dates are YYYY-MM-DD, Chicago time. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function chicagoToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The Thursday on or after the given date. */
export function nextThursday(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return addDays(iso, (4 - dow + 7) % 7)
}

/** "OCT 29" */
export function shortUpper(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1].slice(0, 3).toUpperCase()} ${d}`
}

/** "Mon · Oct 26" */
export function dayLabel(iso: string): string {
  const dt = new Date(`${iso}T12:00:00Z`)
  const [, m, d] = iso.split('-').map(Number)
  return `${DAYS[dt.getUTCDay()]} · ${MONTHS[m - 1].slice(0, 3)} ${d}`
}
