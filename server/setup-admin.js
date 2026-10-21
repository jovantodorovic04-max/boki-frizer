import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync } from 'node:crypto'
import readline from 'node:readline'
const db = new Database(fileURLToPath(new URL('./bookings.sqlite', import.meta.url)))
db.exec(`CREATE TABLE IF NOT EXISTS admin_users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)`)
const username = (process.argv[2] || '').toLowerCase()
if (!['boki', 'miljan'].includes(username)) {
  console.error('Koristi: node setup-admin.js boki  ili  node setup-admin.js miljan')
  process.exit(1)
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question(`Unesi lozinku za ${username} (min 12 znakova; unos se vidi u terminalu): `, password => {
  rl.close()
  if (password.length < 12 || password.length > 128) {
    console.error('Lozinka mora imati 12–128 znakova.')
    process.exitCode = 1
    return
  }
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  db.prepare(`INSERT INTO admin_users(username,password_hash) VALUES (?,?)
    ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`).run(username, `${salt}:${hash}`)
  db.prepare('DELETE FROM admin_sessions WHERE username = ?').run(username)
  console.log(`Nalog ${username} je spreman. Lozinka se ne cuva u cistom tekstu.`)
  db.close()
})
