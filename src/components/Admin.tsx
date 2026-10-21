import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Admin.css'

const API = 'http://127.0.0.1:3001/api'
type Booking = {id:number;time:string;endTime:string;services:string[];firstName:string;lastName:string;phone:string}
type Shift = {weekday:number;start:string;end:string;enabled:boolean}
type Block = {id:number;date:string;start:string;end:string;note:string}
type Service = {name:string;price:number;minutes:number}
const weekDays = ['Nedelja','Ponedeljak','Utorak','Sreda','Četvrtak','Petak','Subota']
const dateStr = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const offsetDate = (date:string,days:number) => {const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return dateStr(d)}
const shortDate = (date:string) => {const [y,m,d]=date.split('-');return `${d}.${m}.${y}.`}
const timeOptions = Array.from({length:67},(_,i)=> {const n=540+i*10;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`})

export default function Admin() {
  const [username,setUsername]=useState('boki')
  const [password,setPassword]=useState('')
  const [token,setToken]=useState('')
  const [date,setDate]=useState(dateStr(new Date()))
  const [view,setView]=useState<'calendar'|'shifts'|'blocks'|'manual'>('calendar')
  const [bookings,setBookings]=useState<Booking[]>([])
  const [shifts,setShifts]=useState<Shift[]>([])
  const [blocks,setBlocks]=useState<Block[]>([])
  const [services,setServices]=useState<Record<string,Service>>({})
  const [picked,setPicked]=useState<string[]>(['classic'])
  const [firstName,setFirstName]=useState('')
  const [lastName,setLastName]=useState('')
  const [phone,setPhone]=useState('')
  const [manualTime,setManualTime]=useState('09:00')
  const [blockStart,setBlockStart]=useState('13:00')
  const [blockEnd,setBlockEnd]=useState('14:00')
  const [blockNote,setBlockNote]=useState('Pauza')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [refresh,setRefresh]=useState(0)
  const [weekly,setWeekly]=useState(false)
  const [weekItems,setWeekItems]=useState<{date:string;items:Booking[]}[]>([])

  async function api(path:string,options:RequestInit={}) {
    const response=await fetch(`${API}${path}`,{
      ...options,
      headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers}
    })
    const result=await response.json()
    if (!response.ok) throw Error(result.error||'Zahtev nije uspeo.')
    return result
  }
  function clearStatus(){setError('');setMessage('')}
  async function perform(task:()=>Promise<void>,success?:string){clearStatus();setBusy(true);try{await task();if(success)setMessage(success)}catch(e){setError(e instanceof Error?e.message:'Došlo je do greške.')}finally{setBusy(false)}}
  async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();await perform(async()=>{
    const r=await fetch(`${API}/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})
    const d=await r.json();if(!r.ok)throw Error(d.error||'Prijava nije uspela.');setToken(d.token);setPassword('')
  })}
  async function logout(){await fetch(`${API}/admin/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});setToken('');setBookings([]);setShifts([]);clearStatus()}
  useEffect(()=>{fetch(`${API}/services`).then(r=>r.json()).then(setServices).catch(()=>{})},[])
  useEffect(()=>{
    if(!token)return
    let cancelled=false
    async function load(){
      try {
        const auth={Authorization:`Bearer ${token}`}
        const get=async(path:string)=>{const r=await fetch(`${API}${path}`,{headers:auth});const d=await r.json();if(!r.ok)throw Error(d.error||'Greška pri učitavanju.');return d}
        if(view==='calendar') {
          if(weekly){
            const d=new Date(`${date}T12:00:00`);const monday=offsetDate(date,-((d.getDay()+6)%7))
            const days=Array.from({length:7},(_,i)=>offsetDate(monday,i))
            const values=await Promise.all(days.map(async day=>({date:day,items:(await get(`/admin/bookings?date=${day}`)).bookings as Booking[]})))
            if(!cancelled)setWeekItems(values)
          } else {const d=await get(`/admin/bookings?date=${date}`);if(!cancelled)setBookings(d.bookings)}
        }
        if(view==='shifts'){const d=await get('/admin/schedule');if(!cancelled)setShifts(d.shifts)}
        if(view==='blocks'){const d=await get(`/admin/blocks?date=${date}`);if(!cancelled)setBlocks(d.blocks)}
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Nije moguće učitati podatke.')}
    }
    load();return()=>{cancelled=true}
  },[token,date,view,refresh,weekly])
  async function cancel(id:number){if(!window.confirm(`Otkazati rezervaciju #${id}? Termin će ponovo biti dostupan.`))return;await perform(async()=>{await api(`/admin/bookings/${id}`,{method:'DELETE'});setRefresh(x=>x+1)},'Rezervacija je otkazana.')}
  async function updateShift(s:Shift){await perform(async()=>{await api(`/admin/schedule/${s.weekday}`,{method:'PUT',body:JSON.stringify({start:s.start,end:s.end,enabled:s.enabled})});setRefresh(x=>x+1)},`Smena za ${weekDays[s.weekday].toLowerCase()} je sačuvana.`)}
  async function addBlock(e:FormEvent){e.preventDefault();await perform(async()=>{await api('/admin/blocks',{method:'POST',body:JSON.stringify({date,start:blockStart,end:blockEnd,note:blockNote})});setRefresh(x=>x+1)},'Period je blokiran.')}
  async function deleteBlock(id:number){if(!window.confirm('Ukloniti ovu blokadu?'))return;await perform(async()=>{await api(`/admin/blocks/${id}`,{method:'DELETE'});setRefresh(x=>x+1)},'Blokada je uklonjena.')}
  async function addManual(e:FormEvent){e.preventDefault();await perform(async()=>{
    const result=await api('/admin/bookings',{method:'POST',body:JSON.stringify({date,time:manualTime,services:picked,firstName,lastName,phone})})
    setMessage(`Rezervacija #${result.id} uspešno dodata!`);setFirstName('');setLastName('');setPhone('');setRefresh(x=>x+1)
  })}
  const total=picked.reduce((r,id)=>({price:r.price+(services[id]?.price||0),minutes:r.minutes+(services[id]?.minutes||0)}),{price:0,minutes:0})
  const renderBookings=(items:Booking[])=>items.length? <div className="admin-booking-list">{items.map(b=><article className="admin-booking" key={b.id}>
    <div><strong>{b.time}–{b.endTime}</strong><small>Rezervacija #{b.id}</small></div>
    <div><b>{b.firstName} {b.lastName}</b><p>{b.services.join(' + ')}</p><a href={`tel:${b.phone}`}>{b.phone}</a></div>
    <button type="button" className="admin-cancel" disabled={busy} onClick={()=>cancel(b.id)}>OTKAŽI</button>
  </article>)}</div>:<p>Nema zakazanih mušterija.</p>
  return <main className="admin-page"><div className="admin-shell">
    <p className="admin-eyebrow">BOKI FRIZER · PRIVATNI PANEL</p><h1>UPRAVLJANJE <span>SALONOM.</span></h1>
    {!token?<form className="admin-panel" onSubmit={login}><h2>Prijava za frizere</h2>
      <label>FRIZER<select value={username} onChange={e=>setUsername(e.target.value)}><option value="boki">Boki</option><option value="miljan">Miljan</option></select></label>
      <label>LOZINKA<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={busy} type="submit">{busy?'PRIJAVA...':'PRIJAVI SE ↗'}</button>
    </form>:<div className="admin-panel">
      <div className="admin-toolbar"><h2>Frizer: {username==='boki'?'Boki':'Miljan'}</h2><button className="admin-logout" onClick={logout}>ODJAVI SE</button></div>
      <nav className="admin-tabs" aria-label="Upravljanje salonom">
        {([['calendar','Kalendar'],['shifts','Smene'],['blocks','Pauze / slobodni dani'],['manual','Ručna rezervacija']] as const).map(([id,label])=><button type="button" key={id} className={view===id?'admin-tab-active':''} onClick={()=>{clearStatus();setView(id)}}>{label}</button>)}
      </nav>
      {view!=='shifts'&&<div className="admin-date-row"><label>IZABERI DATUM<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="admin-date-nav"><button onClick={()=>setDate(d=>offsetDate(d,-1))}>← Prethodni</button><button onClick={()=>setDate(dateStr(new Date()))}>Danas</button><button onClick={()=>setDate(d=>offsetDate(d,1))}>Sledeći →</button></div></div>}
      {view==='calendar'&&<section className="admin-section"><div className="admin-toolbar"><h3>Rezervacije</h3><div className="admin-switch"><button className={!weekly?'admin-tab-active':''} onClick={()=>setWeekly(false)}>Dan</button><button className={weekly?'admin-tab-active':''} onClick={()=>setWeekly(true)}>Nedelja</button></div></div>
        {weekly?<div className="admin-week">{weekItems.map(w=><section className="admin-day" key={w.date}><h4>{weekDays[new Date(`${w.date}T12:00:00`).getDay()]} · {shortDate(w.date)} <small>({w.items.length})</small></h4>{renderBookings(w.items)}</section>)}</div>:<><h4>{shortDate(date)}</h4>{renderBookings(bookings)}</>}
      </section>}
      {view==='shifts'&&<section className="admin-section"><h3>Nedeljne smene</h3><p>Podesi radno vreme za svaki dan. Nedelja je podrazumevano neradna. Izmene odmah utiču na nove rezervacije, ali ne otkazuju već postojeće.</p>
        <div className="admin-shifts">{shifts.map(s=><div className="admin-shift" key={s.weekday}><strong>{weekDays[s.weekday]}</strong><label className="admin-check"><input type="checkbox" checked={s.enabled} onChange={e=>setShifts(old=>old.map(x=>x.weekday===s.weekday?{...x,enabled:e.target.checked}:x))}/> Radi</label>
          <label>Od<select value={s.start} onChange={e=>setShifts(old=>old.map(x=>x.weekday===s.weekday?{...x,start:e.target.value}:x))}>{timeOptions.slice(0,-1).map(t=><option key={t}>{t}</option>)}</select></label>
          <label>Do<select value={s.end} onChange={e=>setShifts(old=>old.map(x=>x.weekday===s.weekday?{...x,end:e.target.value}:x))}>{timeOptions.slice(1).map(t=><option key={t}>{t}</option>)}</select></label>
          <button disabled={busy} onClick={()=>updateShift(s)}>SAČUVAJ</button>
        </div>)}</div>
      </section>}
      {view==='blocks'&&<section className="admin-section"><h3>Pauze i slobodni dani</h3><p>Za ceo slobodan dan izaberi 09:00–20:00. Ne možeš blokirati period u kom već postoji rezervacija.</p>
        <form className="admin-form-grid" onSubmit={addBlock}><label>POČETAK<select value={blockStart} onChange={e=>setBlockStart(e.target.value)}>{timeOptions.slice(0,-1).map(t=><option key={t}>{t}</option>)}</select></label>
          <label>KRAJ<select value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}>{timeOptions.slice(1).map(t=><option key={t}>{t}</option>)}</select></label>
          <label>RAZLOG<input maxLength={100} value={blockNote} onChange={e=>setBlockNote(e.target.value)} placeholder="Pauza, odmor..."/></label>
          <button type="submit" disabled={busy}>BLOKIRAJ PERIOD</button></form>
        <h4>Blokade za {shortDate(date)}</h4>{blocks.length?blocks.map(b=><article className="admin-block" key={b.id}><span><strong>{b.start}–{b.end}</strong> · {b.note||'Blokirano'}</span><button disabled={busy} onClick={()=>deleteBlock(b.id)}>UKLONI</button></article>):<p>Za ovaj dan nema blokada.</p>}
      </section>}
      {view==='manual'&&<section className="admin-section"><h3>Rezervacija preko telefona</h3><p>Ručna rezervacija koristi isti raspored i zauzetost kao javno zakazivanje. Važi za narednih 30 dana.</p>
        <form className="admin-form-grid" onSubmit={addManual}><label>IME<input value={firstName} minLength={2} maxLength={60} required onChange={e=>setFirstName(e.target.value)}/></label>
          <label>PREZIME<input value={lastName} minLength={2} maxLength={60} required onChange={e=>setLastName(e.target.value)}/></label>
          <label>TELEFON<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
          <label>POČETAK<select value={manualTime} onChange={e=>setManualTime(e.target.value)}>{timeOptions.slice(0,-1).map(t=><option key={t}>{t}</option>)}</select></label>
          <fieldset className="admin-service-field"><legend>IZABERI USLUGE</legend>{Object.entries(services).map(([id,s])=><label key={id} className="admin-check"><input type="checkbox" checked={picked.includes(id)} onChange={e=>setPicked(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>{s.name} — {s.price} RSD / {s.minutes} min</label>)}</fieldset>
          <div className="admin-total">Ukupno: <strong>{total.price.toLocaleString('sr-RS')} RSD · {total.minutes} min</strong></div>
          <button type="submit" disabled={busy||picked.length===0}>SAČUVAJ REZERVACIJU</button>
        </form>
      </section>}
    </div>}
    {error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
    <p className="admin-note">Lokalna razvojna verzija. Osvežavanje stranice zahteva novu prijavu. Pre javne objave potrebni su HTTPS, rezervne kopije baze i dodatno bezbednosno testiranje.</p>
  </div></main>
}
