import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import Booking from './components/Booking'
import Admin from './components/Admin'
import './App.css'


const faceLogoSrc = '/images/logo-face.png'

const linkedInUrl = 'https://www.linkedin.com/in/jovan-todorovic-5453a0420/'


const services = [
  { name: 'Klasično šišanje', duration: '20 min', price: 700, icon: '✂' },
  { name: 'Šišanje za penzionere', duration: '20 min', price: 500, icon: '✂' },
  { name: 'Šišanje za decu', duration: '20 min', price: 500, icon: '✂' },
  { name: 'Šišanje „0”', duration: '15 min', price: 400, icon: '✂' },
  { name: 'Fade frizure', duration: '30 min', price: 900, icon: '✂' },
  { name: 'Stilizovanje brade', duration: '15 min', price: 400, icon: '⌁' },
  { name: 'Skidanje brade', duration: '15 min', price: 200, icon: '⌁' },
  { name: 'Pranje kose', duration: '10 min', price: 200, icon: '◈' },
]

const barbers = [
  {
    name: 'Boki',
    role: 'FRIZER 01',
    photo: '',
    shift: '09:00 – 16:00',
    subtitle: 'Classic cuts · Fade · Beard',
    hint: '',
  },
  {
    name: 'Miljan',
    role: 'FRIZER 02',
    photo: '/images/miljan.png',
    shift: '13:00 – 20:00',
    subtitle: 'Fresh cuts · Good vibes',
    hint: '',
  },
]

const gallery = [
  '/images/frizura-1.png',
  '/images/frizura-2.png',
  '/images/frizura-3.png',
]


function ScrollToPagePosition() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0)
      return
    }

    const scrollToSection = () => {
      const sectionId = location.hash.substring(1)
      const section = document.getElementById(sectionId)

      if (section) {
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }

    const timer = window.setTimeout(scrollToSection, 100)

    return () => window.clearTimeout(timer)
  }, [location.pathname, location.hash, location.key])

  return null
}


function Palm({ flip = false }: { flip?: boolean }) {
  return (
    <svg className={`palm ${flip ? 'palm-flip' : ''}`} viewBox="0 0 190 320" fill="none" aria-hidden="true">
      <path d="M96 315C89 247 95 191 114 120" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M114 121C77 89 43 95 8 118C47 112 76 115 109 130" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M114 121C93 70 62 42 21 34C57 64 78 91 109 127" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M114 121C108 70 123 35 152 12C137 55 132 84 118 125" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M114 121C134 87 153 83 183 82C149 106 141 118 117 131" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M112 120C62 119 40 142 24 176C54 155 81 143 114 133" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M115 121C146 125 166 140 184 172C155 153 139 144 114 135" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location])

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label="Boki Frizer početna strana">
          <img src={faceLogoSrc} alt="Boki Frizer logo" />
          <div className="logo-text">
            <span>BOKI FRIZER</span>
            <small>BARBER SHOP · KRUŠEVAC</small>
          </div>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Zatvori meni' : 'Otvori meni'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
          <Link to="/">Početna</Link>
          <Link to="/#usluge">Cenovnik</Link>
          <Link to="/galerija">Galerija</Link>
          <Link to="/#frizeri">Frizeri</Link>
          <Link to="/#kontakt">Kontakt</Link>
          <Link to="/#zakazivanje" className="nav-cta">ZAKAŽI TERMIN ↗</Link>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="pocetna">
      <div className="hero-overlay" />
      <div className="container hero-inner">
        <div className="hero-content">
          <h1>FADE KOJI<br /><span>NE PROLAZI</span><br />NEPRIMEĆENO.</h1>
          <p className="hero-desc">
            Barber shop sa karakterom — dobre frizure, dobar vajb i prepoznatljiv neon stil.
            Boki i Miljan te čekaju na adresi Aerodromska 23/a.
          </p>
          <div className="hero-buttons">
            <Link to="/#zakazivanje" className="btn btn-main">ZAKAŽI TERMIN ↗</Link>
            <Link to="/galerija" className="btn btn-ghost">POGLEDAJ GALERIJU →</Link>
          </div>
          <div className="hero-data">
            <div><strong>02</strong><span>FRIZERA</span></div>
            <i />
            <div><strong>09–20h</strong><span>PON – SUB</span></div>
            <i />
            <div><strong>063 1908 911</strong><span>TELEFON</span></div>
          </div>
        </div>

        <div className="hero-scene" aria-label="Neon Boki Frizer scena">
          <div className="sun-glow" />
          <Palm />
          <Palm flip />

          <div className="hero-sign-wrap">
            <div className="sign-rope" />
            <div className="hero-card">
              <div className="hero-card-top">THE ORIGINAL BARBER SHOP</div>

              <div className="hero-sign-center">
                <div className="pole-inside" aria-hidden="true">
                  <div className="pole-cap top" />
                  <div className="pole-body" />
                  <div className="pole-cap bottom" />
                </div>

                <div className="hero-neon-title">
                  <span className="hero-neon-main">BOKI</span>
                  <span className="hero-neon-accent">FRIZER</span>
                  <small>HAIRCUTS <span>&</span> SHAVES</small>
                </div>
              </div>
            </div>
          </div>

          <div className="floor-glow" />
        </div>
      </div>
    </section>
  )
}

type PhotoSlotProps = {
  src: string
  alt: string
  className?: string
  title: string
  hint?: string
}

function PhotoSlot({ src, alt, className = '', title, hint }: PhotoSlotProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div className={`photo-slot ${className}`}>
      {showImage ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      ) : (
        <div className="photo-placeholder">
          <div className="photo-placeholder-icon">✂</div>
          <strong>{title}</strong>
          {hint ? <small>{hint}</small> : null}
        </div>
      )}
    </div>
  )
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}<span>.</span></h2>
      {text && <p className="section-text">{text}</p>}
    </div>
  )
}

function HomePage() {
  return (
    <main>
      <Hero />

      <section className="section container" id="usluge">
        <SectionHeading
          eyebrow="01 / CENOVNIK"
          title="USLUGE I CENE"
        />
        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.name}>
              <span className="service-icon">{service.icon}</span>
              <div className="service-info">
                <h3>{service.name}</h3>
                <p>Trajanje: {service.duration}</p>
              </div>
              <strong>{service.price} <small>RSD</small></strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="frizeri">
        <div className="container">
          <SectionHeading
            eyebrow="02 / UPOZNAJ EKIPU"
            title="BOKI & MILJAN"
          />
          <div className="team-grid">
            {barbers.map((barber) => (
              <article className="team-card" key={barber.name}>
                <PhotoSlot
                  src={barber.photo}
                  alt={barber.name}
                  className="team-photo"
                  title={barber.name}
                  hint={barber.hint}
                />
                <div className="team-meta">
                  <div>
                    <span>{barber.role}</span>
                    <h3>{barber.name}</h3>
                    <p className="team-subtitle">{barber.subtitle}</p>
                  </div>
                  <p className="team-shift">Primer smene: {barber.shift}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section container gallery-cta">
        <div>
          <p className="eyebrow">03 / GALERIJA RADOVA</p>
          <h2>POGLEDAJ NAŠE<br /><span>RADOVE</span></h2>
        </div>
        <Link to="/galerija" className="btn btn-main">OTVORI GALERIJU ↗</Link>
      </section>

      <section className="section section-dark" id="zakazivanje">
        <div className="container">
          <SectionHeading
            eyebrow="04 / ONLINE TERMIN"
            title="ZAKAŽI ŠIŠANJE"
          />
          <Booking /> 
        </div>
      </section>

      <section className="section container" id="kontakt">
        <SectionHeading eyebrow="05 / KONTAKT" title="SVRATI DO NAS" />
        <div className="contact-grid">
          <article className="contact-card">
            <span>RADNO VREME</span>
            <h3>Ponedeljak – Subota</h3>
            <strong>09:00 – 20:00</strong>
          </article>

          <article className="contact-card">
            <span>LOKACIJA</span>
            <h3>Aerodromska 23/a</h3>
            <p>Kruševac, Srbija</p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Aerodromska%2023%2Fa%2C%20Kru%C5%A1evac"
              target="_blank"
              rel="noreferrer"
              className="contact-link"
            >
              OTVORI MAPU ↗
            </a>
          </article>

          <article className="contact-card">
            <span>TELEFON</span>
            <h3>063 1908 911</h3>
            <p>Pozovi salon direktno.</p>
            <a href="tel:+381631908911" className="contact-link">POZOVI ↗</a>
          </article>
        </div>
      </section>
    </main>
  )
}

function GalleryPage() {
  return (
    <main className="gallery-page">
      <div className="container">
        <Link to="/" className="back-link">← NAZAD NA POČETNU</Link>
        <SectionHeading
          eyebrow="BOKI FRIZER / GALERIJA"
          title="GALERIJA FRIZURA"
        />
        <div className="gallery-grid">
          {gallery.map((photo, index) => (
            <PhotoSlot
              key={index}
              src={photo}
              alt={`Frizura ${index + 1}`}
              className="gallery-photo"
              title={`FRIZURA ${String(index + 1).padStart(2, '0')}`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link to="/" className="logo footer-logo">
          <img src={faceLogoSrc} alt="Boki Frizer logo" />
          <div className="logo-text">
            <span>BOKI FRIZER</span>
            <small>HAIRCUTS · SHAVES · GOOD VIBES</small>
          </div>
        </Link>
        <div className="footer-credit">
          <Link to="/admin" className="admin-login-link">
             ADMIN PRIJAVA ↗
          </Link>
          <p>© {new Date().getFullYear()} Boki Frizer · Aerodromska 23/a · Kruševac</p>
          <p>
            Designed &amp; Developed by{' '}
            {linkedInUrl ? (
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="creator-link" aria-label="JOCHA — LinkedIn profil">
                JOCHA ↗
              </a>
            ) : (
              <span className="creator-link">JOCHA</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToPagePosition />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/galerija" element={<GalleryPage />} />
        <Route path="*" element={<HomePage />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}

export default App
