import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'

const app = express()
const db = new Database(fileURLToPath(new URL('./bookings.sqlite', import.meta.url)))
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,
  barber TEXT NOT NULL,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bookings_by_time ON bookings (date, barber, start_min, end_min);`)
// Non-destructive migration: previously booked appointments remain untouched.
if (!db.pragma('table_info(bookings)').some(col => col.name === 'services_json')) {
  db.exec('ALTER TABLE bookings ADD COLUMN services_json TEXT')
}

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '10kb' }))

const SERVICES = {
  classic: { name: 'Klasično šišanje', minutes: 20, price: 700 },
  senior: { name: 'Šišanje za penzionere', minutes: 20, price: 500 },
  child: { name: 'Šišanje za decu', minutes: 20, price: 500 },
  zero: { name: 'Šišanje „0”', minutes: 15, price: 400 },
  fade: { name: 'Fade frizure', minutes: 30, price: 900 },
  beard_style: { name: 'Stilizovanje brade', minutes: 15, price: 400 },
  beard_remove: { name: 'Skidanje brade', minutes: 15, price: 200 },
  wash: { name: 'Pranje kose', minutes: 10, price: 200 },
}
const SHIFTS = { boki: [540, 960], miljan: [780, 1200] }
const BARBERS = Object.keys(SHIFTS)
// V2 tables persist weekly shifts and date-specific blocks. No existing bookings are modified.
db.exec(`CREATE TABLE IF NOT EXISTS barber_shifts (
  barber TEXT NOT NULL, weekday INTEGER NOT NULL, start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (barber,weekday)
);
CREATE TABLE IF NOT EXISTS barber_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, barber TEXT NOT NULL, date TEXT NOT NULL,
  start_min INTEGER NOT NULL, end_min INTEGER NOT NULL, note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS barber_blocks_lookup ON barber_blocks (barber,date,start_min,end_min);`)
const seedShift = db.prepare(`INSERT OR IGNORE INTO barber_shifts
 (barber,weekday,start_min,end_min,enabled) VALUES (?,?,?,?,?)`)
for (const barber of BARBERS) for (let weekday = 0; weekday < 7; weekday++) {
  seedShift.run(barber, weekday, ...SHIFTS[barber], weekday === 0 ? 0 : 1)
}
const weekdayOf = date => new Date(`${date}T12:00:00Z`).getUTCDay()
const shiftFor = (barber,date) => db.prepare('SELECT start_min,end_min,enabled FROM barber_shifts WHERE barber = ? AND weekday = ?').get(barber,weekdayOf(date))
const clashes = (start,end,otherStart,otherEnd) => start < otherEnd && end > otherStart
const validCalendarDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date
const withinBookingWindow = date => {
  if (!validCalendarDate(date)) return false
  const today = todayBelgrade()
  const max = new Date(`${today}T12:00:00Z`)
  max.setUTCDate(max.getUTCDate() + 30)
  return date >= today && date <= max.toISOString().slice(0,10)
}
const isSlotFree = (barber,date,start,end) => {
  const shift = shiftFor(barber,date)
  if (!shift || !shift.enabled || start < shift.start_min || end > shift.end_min) return false
  const booked = db.prepare('SELECT start_min,end_min FROM bookings WHERE barber=? AND date=?').all(barber,date)
  if (booked.some(b=>clashes(start,end,b.start_min,b.end_min))) return false
  const blocks = db.prepare('SELECT start_min,end_min FROM barber_blocks WHERE barber=? AND date=?').all(barber,date)
  return !blocks.some(b=>clashes(start,end,b.start_min,b.end_min))
}
const pad = n => String(n).padStart(2, '0')
const fmt = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`
const parseTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) : NaN
const todayBelgrade = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = name => parts.find(p => p.type === name)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
const nowMinutes = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  return Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value)
}
const dayOkay = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return false
  const today = todayBelgrade()
  const max = new Date(`${today}T12:00:00Z`)
  max.setUTCDate(max.getUTCDate() + 30)
  return date >= today && date <= max.toISOString().slice(0, 10)
}

const validServiceIds = ids => Array.isArray(ids) && ids.length > 0 && ids.length <= 8 && ids.every(id => typeof id === 'string' && Object.hasOwn(SERVICES, id)) && new Set(ids).size === ids.length
const totals = ids => ids.reduce((all, id) => ({ minutes: all.minutes + SERVICES[id].minutes, price: all.price + SERVICES[id].price }), { minutes: 0, price: 0 })
const available = (date, serviceIds, choice) => {
  const duration = totals(serviceIds).minutes
  const list = []
  for (let time = 540; time <= 1190; time += 10) {
    if (date === todayBelgrade() && time <= nowMinutes() + 10) continue
    const free = BARBERS.filter(barber => isSlotFree(barber,date,time,time+duration))
    const possible = choice === 'any' ? free : free.filter(b => b === choice)
    if (possible.length) list.push({ time: fmt(time), barbers: possible })
  }
  return list
}

app.get('/api/services', (_req, res) => res.json(SERVICES))
app.get('/api/availability', (req, res) => {
  const { date, barber = 'any' } = req.query
  const ids = typeof req.query.services === 'string' ? req.query.services.split(',') : typeof req.query.service === 'string' ? [req.query.service] : []
  if (!dayOkay(date) || !validServiceIds(ids) || ![...BARBERS, 'any'].includes(barber)) {
    return res.status(400).json({ error: 'Neispravan datum, usluge ili frizer.' })
  }
  res.json({ slots: available(date, ids, barber), ...totals(ids) })
})

const createBooking = db.transaction(input => {
  const start = parseTime(input.time)
  const duration = totals(input.services).minutes
  const choices = available(input.date, input.services, input.barber).find(s => s.time === input.time)?.barbers || []
  const selected = input.barber === 'any' ? choices[0] : input.barber
  if (!choices.includes(selected)) return null
  const info = db.prepare(`INSERT INTO bookings (service, services_json, barber, date, start_min, end_min, first_name, last_name, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.services.join(','), JSON.stringify(input.services), selected, input.date, start, start + duration, input.firstName, input.lastName, input.phone)
  return { id: Number(info.lastInsertRowid), barber: selected, date: input.date, time: input.time,
    services: input.services.map(id => SERVICES[id].name), ...totals(input.services) }
})
app.post('/api/bookings', (req, res) => {
  const b = req.body || {}
  const ids = b.services ?? (typeof b.service === 'string' ? [b.service] : [])
  const clean = {
    services: ids, barber: b.barber, date: b.date, time: b.time,
    firstName: typeof b.firstName === 'string' ? b.firstName.trim() : '',
    lastName: typeof b.lastName === 'string' ? b.lastName.trim() : '',
    phone: typeof b.phone === 'string' ? b.phone.trim() : '',
  }
  if (!validServiceIds(clean.services) || ![...BARBERS, 'any'].includes(clean.barber) || !dayOkay(clean.date) || !Number.isFinite(parseTime(clean.time)) ||
      clean.firstName.length < 2 || clean.firstName.length > 60 || clean.lastName.length < 2 || clean.lastName.length > 60 ||
      !/^\+?[\d\s()\-]{7,20}$/.test(clean.phone)) {
    return res.status(400).json({ error: 'Proveri podatke i pokušaj ponovo.' })
  }
  try {
    const result = createBooking(clean)
    if (!result) return res.status(409).json({ error: 'Termin je upravo zauzet. Izaberi drugi.' })
    res.status(201).json(result)
  } catch (error) {
    console.error('Booking failed:', error)
    res.status(500).json({ error: 'Došlo je do greške pri čuvanju rezervacije.' })
  }
})

// ADMIN V1: Only authenticated barbers can see personal customer information.
db.exec(`CREATE TABLE IF NOT EXISTS admin_users (
 username TEXT PRIMARY KEY, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at INTEGER NOT NULL,
 FOREIGN KEY (username) REFERENCES admin_users(username)
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);`)

const sha = value => createHash('sha256').update(value).digest('hex')
const loginAttempts = new Map()
function requireAdmin(req, res, next) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ error: 'Potrebna je prijava.' })
  const session = db.prepare('SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .get(sha(match[1]), Date.now())
  if (!session) return res.status(401).json({ error: 'Sesija je istekla. Prijavi se ponovo.' })
  req.adminUser = session.username
  req.adminTokenHash = sha(match[1])
  next()
}
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const hits = (loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60_000)
  if (hits.length >= 8) return res.status(429).json({ error: 'Previše pokušaja. Pokušaj za 15 minuta.' })
  hits.push(now)
  loginAttempts.set(ip, hits)
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const user = db.prepare('SELECT password_hash FROM admin_users WHERE username = ?').get(username)
  let matched = false
  if (user && password.length <= 256) {
    const [salt, key] = user.password_hash.split(':')
    if (salt && key && /^[0-9a-f]+$/.test(key)) {
      const expected = Buffer.from(key, 'hex')
      const provided = scryptSync(password, salt, expected.length)
      matched = timingSafeEqual(expected, provided)
    }
  }
  if (!matched) return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' })
  loginAttempts.delete(ip)
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now)
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
    .run(sha(token), username, now + 8 * 60 * 60_000)
  res.json({ token, username, expiresInHours: 8 })
})
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(req.adminTokenHash)
  res.json({ ok: true })
})
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const date = req.query.date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Izaberi ispravan datum.' })
  }
  // Each barber sees only their own customers (no cross-account access).
  const rows = db.prepare(`SELECT id, barber, date, start_min, end_min,
    service, services_json, first_name, last_name, phone
    FROM bookings WHERE date = ? AND barber = ? ORDER BY start_min`).all(date, req.adminUser)
  res.json({ bookings: rows.map(row => ({
    id: row.id, barber: row.barber, date: row.date,
    time: fmt(row.start_min), endTime: fmt(row.end_min),
    services: (() => {
      try { const ids = row.services_json ? JSON.parse(row.services_json) : row.service.split(',');
        return ids.map(id => SERVICES[id]?.name || id)
      } catch { return [row.service] }
    })(),
    firstName: row.first_name, lastName: row.last_name, phone: row.phone
  })) })
})
app.delete('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Neispravan ID.' })
  const result = db.prepare('DELETE FROM bookings WHERE id = ? AND barber = ?').run(Number(req.params.id), req.adminUser)
  if (!result.changes) return res.status(404).json({ error: 'Rezervacija nije pronađena.' })
  res.json({ ok: true })
})


// ADMIN V2: Calendar, personal weekly shifts, breaks/days off, and phone bookings.
const minuteOkay = value => Number.isInteger(value) && value >= 0 && value <= 1440 && value % 10 === 0
const adminDateOkay = date => validCalendarDate(date) && date >= '2020-01-01' && date <= '2100-12-31'
app.get('/api/admin/schedule', requireAdmin, (req,res) => {
  const shifts = db.prepare('SELECT weekday,start_min,end_min,enabled FROM barber_shifts WHERE barber=? ORDER BY weekday').all(req.adminUser)
  res.json({shifts: shifts.map(s => ({weekday:s.weekday,start:fmt(s.start_min),end:fmt(s.end_min),enabled:!!s.enabled}))})
})
app.put('/api/admin/schedule/:weekday', requireAdmin, (req,res) => {
  const weekday = Number(req.params.weekday)
  const start = parseTime(req.body?.start), end = parseTime(req.body?.end)
  const enabled = req.body?.enabled
  if (!/^\d$/.test(req.params.weekday) || weekday < 0 || weekday > 6 || typeof enabled !== 'boolean' ||
    !minuteOkay(start) || !minuteOkay(end) || start < 540 || end > 1200 || end-start < 10) {
    return res.status(400).json({error:'Smena mora biti između 09:00 i 20:00, minimum 10 minuta (korak 10 minuta).'})
  }
  db.prepare(`INSERT INTO barber_shifts(barber,weekday,start_min,end_min,enabled) VALUES (?,?,?,?,?)
    ON CONFLICT(barber,weekday) DO UPDATE SET start_min=excluded.start_min,end_min=excluded.end_min,enabled=excluded.enabled`)
    .run(req.adminUser,weekday,start,end,enabled?1:0)
  res.json({ok:true})
})
app.get('/api/admin/blocks', requireAdmin, (req,res) => {
  const date = req.query.date
  if (!adminDateOkay(date)) return res.status(400).json({error:'Neispravan datum.'})
  const rows = db.prepare('SELECT id,date,start_min,end_min,note FROM barber_blocks WHERE barber=? AND date=? ORDER BY start_min').all(req.adminUser,date)
  res.json({blocks:rows.map(b=>({id:b.id,date:b.date,start:fmt(b.start_min),end:fmt(b.end_min),note:b.note}))})
})
app.post('/api/admin/blocks', requireAdmin, (req,res) => {
  const {date,note=''} = req.body || {}
  const start=parseTime(req.body?.start),end=parseTime(req.body?.end)
  if (!adminDateOkay(date) || date < todayBelgrade() || !minuteOkay(start) || !minuteOkay(end) ||
      end <= start || start < 540 || end > 1200 || typeof note !== 'string' || note.length > 100) {
    return res.status(400).json({error:'Proveri datum, vreme i opis blokade.'})
  }
  // Existing reservations stay active; explicitly reject an overlapping block.
  const conflicts=db.prepare('SELECT id FROM bookings WHERE barber=? AND date=? AND start_min < ? AND end_min > ?').get(req.adminUser,date,end,start)
  if (conflicts) return res.status(409).json({error:'Postoji zakazana mušterija u ovom periodu. Prvo reši tu rezervaciju.'})
  const row=db.prepare('INSERT INTO barber_blocks(barber,date,start_min,end_min,note) VALUES (?,?,?,?,?)').run(req.adminUser,date,start,end,note.trim())
  res.status(201).json({id:Number(row.lastInsertRowid),ok:true})
})
app.delete('/api/admin/blocks/:id', requireAdmin, (req,res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Neispravan ID.'})
  const result=db.prepare('DELETE FROM barber_blocks WHERE id=? AND barber=?').run(Number(req.params.id),req.adminUser)
  if (!result.changes) return res.status(404).json({error:'Blokada nije pronađena.'})
  res.json({ok:true})
})
const manualBooking = db.transaction(input => {
  const start=parseTime(input.time),end=start+totals(input.services).minutes
  if (!isSlotFree(input.barber,input.date,start,end)) return null
  const row=db.prepare(`INSERT INTO bookings (service,services_json,barber,date,start_min,end_min,first_name,last_name,phone)
  VALUES (?,?,?,?,?,?,?,?,?)`).run(input.services.join(','),JSON.stringify(input.services),input.barber,input.date,start,end,input.firstName,input.lastName,input.phone)
  return {id:Number(row.lastInsertRowid),date:input.date,time:input.time,barber:input.barber,...totals(input.services)}
})
app.post('/api/admin/bookings', requireAdmin, (req,res) => {
  const b=req.body || {}
  const input={services:b.services,barber:req.adminUser,date:b.date,time:b.time,
    firstName:typeof b.firstName==='string'?b.firstName.trim():'',
    lastName:typeof b.lastName==='string'?b.lastName.trim():'',
    phone:typeof b.phone==='string'?b.phone.trim():''}
  const start=parseTime(input.time)
  if (!validServiceIds(input.services) || !withinBookingWindow(input.date) || !minuteOkay(start) ||
      (input.date===todayBelgrade() && start<=nowMinutes()+10) ||
      input.firstName.length<2 || input.firstName.length>60 || input.lastName.length<2 || input.lastName.length>60 ||
      !/^\+?[\d\s()\-]{7,20}$/.test(input.phone)) {
    return res.status(400).json({error:'Proveri podatke. Ručna rezervacija mora biti u narednih 30 dana i u slobodnoj smeni.'})
  }
  const row=manualBooking(input)
  if (!row) return res.status(409).json({error:'Period nije slobodan ili izlazi van smene.'})
  res.status(201).json(row)
})
app.listen(3001, '127.0.0.1', () => console.log('Boki Booking API: http://127.0.0.1:3001'))
