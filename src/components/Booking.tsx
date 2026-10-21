import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './Booking.css'

type Slot = { time: string; barbers: string[] }
type Service = { name: string; minutes: number; price: number }
const BASE = 'http://127.0.0.1:3001/api'
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const money = (n: number) => `${n.toLocaleString('sr-RS')} RSD`

export default function Booking() {
  const [services, setServices] = useState<Record<string, Service>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [barber, setBarber] = useState('any')
  const [date, setDate] = useState(localDate(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [time, setTime] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [servicesLoaded, setServicesLoaded] = useState(false)

  const totals = useMemo(() => selected.reduce((sum, id) => ({
    minutes: sum.minutes + (services[id]?.minutes ?? 0),
    price: sum.price + (services[id]?.price ?? 0),
  }), { minutes: 0, price: 0 }), [selected, services])

  useEffect(() => {
    const controller = new AbortController()
    async function loadServices() {
      try {
        const response = await fetch(`${BASE}/services`, { signal: controller.signal })
        if (!response.ok) throw new Error('Usluge nisu dostupne.')
        const data: Record<string, Service> = await response.json()
        setServices(data)
        setServicesLoaded(true)
        setError('')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Nije moguće učitati usluge. Proveri backend na portu 3001.')
      }
    }
    loadServices()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    setTime('')
    if (!selected.length) {
      setSlots([])
      setLoadingSlots(false)
      return
    }
    const controller = new AbortController()
    setLoadingSlots(true)
    const params = new URLSearchParams({ date, services: selected.join(','), barber })
    fetch(`${BASE}/availability?${params}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Termini trenutno nisu dostupni.')
        return data
      })
      .then(data => {
        setSlots(Array.isArray(data.slots) ? data.slots : [])
        setError('')
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setSlots([])
          setError(err instanceof Error ? err.message : 'Nije moguće učitati termine.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false) })
    return () => controller.abort()
  }, [date, selected, barber, refresh])

  function toggleService(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected.length || !time) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: selected, barber, date, time, firstName, lastName, phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Rezervacija nije uspela.')
      setSuccess(`Uspešno rezervisano! ${data.date} u ${data.time} kod ${data.barber === 'boki' ? 'Bokija' : 'Miljana'}. Ukupno ${money(data.price)} / ${data.minutes} min. Broj rezervacije: ${data.id}.`)
      setTime('')
      setFirstName('')
      setLastName('')
      setPhone('')
      setRefresh(value => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri zakazivanju.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="boki-booking">
      <form onSubmit={submit}>
        <div className="booking-form-grid">
          <div className="service-field" ref={dropdownRef}>
            <span className="booking-field-label">USLUGE</span>
            <button className="service-dropdown-trigger" type="button" onClick={() => setDropdownOpen(!dropdownOpen)} aria-expanded={dropdownOpen} aria-controls="service-dropdown-list">
              <span>{selected.length ? `${selected.length} ${selected.length === 1 ? 'izabrana usluga' : 'izabrane usluge'}` : 'Izaberi usluge'}</span>
              <span aria-hidden="true">{dropdownOpen ? '⌃' : '⌄'}</span>
            </button>
            {dropdownOpen && (
              <div className="service-dropdown-list" id="service-dropdown-list">
                {Object.entries(services).map(([id, item]) => (
                  <label className="service-option" key={id}>
                    <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleService(id)} />
                    <span className="service-option-name"><strong>{item.name}</strong><small>{item.minutes} min</small></span>
                    <span className="service-option-price">{money(item.price)}</span>
                  </label>
                ))}
                {!Object.keys(services).length && <p className="empty-services">{servicesLoaded ? 'Nema dostupnih usluga.' : 'Učitavanje usluga...'}</p>}
                <button type="button" className="service-dropdown-close" onClick={() => setDropdownOpen(false)}>POTVRDI IZBOR ✓</button>
              </div>
            )}
            <div className="booking-total" aria-live="polite">
              <span>UKUPNO VREME <strong>{totals.minutes} min</strong></span>
              <span>UKUPNA CENA <strong>{money(totals.price)}</strong></span>
            </div>
          </div>
          <label>FRIZER
            <select value={barber} onChange={event => setBarber(event.target.value)}>
              <option value="any">Bilo koji slobodan</option>
              <option value="boki">Boki</option>
              <option value="miljan">Miljan</option>
            </select>
          </label>
          <label>DATUM
            <input type="date" required min={localDate(new Date())} max={localDate(new Date(Date.now() + 30 * 86400000))} value={date} onChange={event => setDate(event.target.value)} />
          </label>
        </div>
        <p className="booking-label">SLOBODNI TERMINI</p>
        <div className="booking-slots" aria-live="polite">
          {!selected.length ? <p>Prvo izaberi jednu ili više usluga.</p> : loadingSlots ? <p>Učitavanje termina...</p> : slots.length ?
            slots.map(slot => <button type="button" key={slot.time} className={time === slot.time ? 'selected' : ''} onClick={() => setTime(slot.time)}>{slot.time}</button>) :
            <p>Nema slobodnih termina za izabrani datum i usluge.</p>}
        </div>
        <div className="booking-form-grid personal">
          <label>IME<input required minLength={2} maxLength={60} value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="Ime" /></label>
          <label>PREZIME<input required minLength={2} maxLength={60} value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Prezime" /></label>
          <label>TELEFON<input type="tel" required minLength={7} maxLength={20} value={phone} onChange={event => setPhone(event.target.value)} placeholder="06x xxx xxxx" /></label>
        </div>
        <button className="booking-submit" type="submit" disabled={loading || loadingSlots || !selected.length || !time}>{loading ? 'ČUVANJE...' : 'POTVRDI REZERVACIJU ↗'}</button>
        {error && <p className="booking-error" role="alert">{error}</p>}
        {success && <p className="booking-success" role="status">{success}</p>}
      </form>
    </div>
  )
}
