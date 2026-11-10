import { Suspense, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  FileText,
  ClipboardList,
  MessageCircle,
  Users,
  Award,
  BarChart3,
  LogOut,
  Target,
  Settings,
  ChevronDown,
  LayoutGrid,
  Bell,
  UserRound,
  LifeBuoy,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar, PageLoader } from '@/components/ui'
import { GuidaButton, Guida } from '@/components/Guida'
import { NotificheBell } from '@/components/NotificheBell'
import { GateConsensoPrivacy } from '@/components/GateConsensoPrivacy'
import { GateAccordoDpa } from '@/components/GateAccordoDpa'
import { BannerUrgenti } from '@/components/BannerUrgenti'
import { getLogoCsain } from '@/api/piattaforma'
import { messaggiNonLetti } from '@/api/chat'
import { useNotifiche } from '@/hooks/useNotifiche'
import { RUOLO_LABEL, nomeCompleto } from '@/lib/format'
import type { RuoloUtente } from '@/lib/database.types'

interface VoceNav {
  to: string
  label: string
  icona: typeof LayoutDashboard
  soloRuoli?: RuoloUtente[]
}

const NAV: VoceNav[] = [
  { to: '/', label: 'Cruscotto', icona: LayoutDashboard },
  { to: '/corsi', label: 'Corsi', icona: GraduationCap },
  { to: '/calendario', label: 'Calendario', icona: CalendarDays },
  { to: '/documenti', label: 'Documenti', icona: FileText },
  { to: '/moduli', label: 'Modulistica', icona: ClipboardList },
  { to: '/chat', label: 'Chat', icona: MessageCircle },
  {
    to: '/membri',
    label: 'Membri',
    icona: Users,
    soloRuoli: ['AMMINISTRATORE_ASD', 'ISTRUTTORE'],
  },
  {
    to: '/standard',
    label: 'Standard',
    icona: Award,
    soloRuoli: ['PROGRAMMATORE'],
  },
  {
    to: '/piattaforma',
    label: 'Piattaforma',
    icona: BarChart3,
    soloRuoli: ['PROGRAMMATORE'],
  },
]

/** Le 4 voci sempre visibili nella barra inferiore del telefono; le altre vanno in "Altro". */
function vociPrincipaliMobile(ruolo: RuoloUtente | null): string[] {
  if (ruolo === 'PROGRAMMATORE') return ['/', '/piattaforma', '/standard', '/corsi']
  return ['/', '/corsi', '/calendario', '/chat']
}

function Contatore({ n, className = '' }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <span
      className={`flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[1.1rem] text-white ${className}`}
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}

export default function Layout() {
  const { profilo, asd, ruolo, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAperto, setMenuAperto] = useState(false)
  const [altroAperto, setAltroAperto] = useState(false)
  const [guidaAperta, setGuidaAperta] = useState(false)
  const { data: logoCsain } = useQuery({ queryKey: ['logo-csain'], queryFn: getLogoCsain })

  // Stessa chiave della campanella: un'unica richiesta condivisa.
  const nonLettiChat = useQuery({ queryKey: ['non-letti'], queryFn: messaggiNonLetti, refetchInterval: 20_000 })
  const nChat = (nonLettiChat.data ?? []).reduce((n, r) => n + Number(r.non_letti), 0)
  const { nonLette } = useNotifiche()

  const voci = NAV.filter((v) => !v.soloRuoli || (ruolo && v.soloRuoli.includes(ruolo)))
  const principali = vociPrincipaliMobile(ruolo)
  const vociBarra = principali
    .map((to) => voci.find((v) => v.to === to))
    .filter((v): v is VoceNav => !!v)
  const vociAltro = voci.filter((v) => !principali.includes(v.to))

  // Il foglio "Altro" si chiude a ogni cambio pagina e con Esc.
  useEffect(() => {
    setAltroAperto(false)
    setMenuAperto(false)
  }, [location.pathname])
  useEffect(() => {
    if (!altroAperto) return
    const suTasto = (e: KeyboardEvent) => e.key === 'Escape' && setAltroAperto(false)
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [altroAperto])

  const percorsiAltro = [...vociAltro.map((v) => v.to), '/notifiche', '/profilo', '/impostazioni', '/registro-accessi']
  const inAltro = percorsiAltro.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
  const badgeAltro = nonLette.length + (vociAltro.some((v) => v.to === '/chat') ? nChat : 0)

  async function esci() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen md:flex">
      <GateConsensoPrivacy />
      <GateAccordoDpa />
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
        <div className="flex min-w-0 items-center gap-2 px-5 py-5">
          {logoCsain && <img src={logoCsain} alt="CSAIN" className="h-8 w-8 shrink-0 object-contain" />}
          {asd?.logo ? (
            <img src={asd.logo} alt="Logo" className="h-8 w-8 shrink-0 rounded object-contain" />
          ) : (
            <Target className="h-7 w-7 shrink-0 text-brand-700" />
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-slate-900">{asd?.nome ?? 'IstruttoriCSAIn'}</p>
            <p className="truncate text-xs text-slate-400">Gestione corsi ASD</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {voci.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <v.icona className="h-5 w-5" />
              <span className="flex-1">{v.label}</span>
              {v.to === '/chat' && <Contatore n={nChat} />}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-200 p-3">
          <NavLink
            to="/impostazioni"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Settings className="h-5 w-5" /> Impostazioni
          </NavLink>
        </div>
      </aside>

      {/* Colonna principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            {logoCsain && <img src={logoCsain} alt="CSAIN" className="h-7 w-7 shrink-0 object-contain" />}
            {asd?.logo ? (
              <img src={asd.logo} alt="Logo" className="h-7 w-7 shrink-0 rounded object-contain" />
            ) : (
              <Target className="h-6 w-6 shrink-0 text-brand-700" />
            )}
            <span className="truncate font-bold text-slate-900">{asd?.nome ?? 'IstruttoriCSAIn'}</span>
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm text-slate-400">{asd?.nome ?? 'Area piattaforma'}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
          <NotificheBell />
          <div className="hidden md:block">
            <GuidaButton />
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuAperto((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100"
            >
              {profilo && <Avatar nome={profilo.nome} cognome={profilo.cognome} />}
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-slate-800">
                  {nomeCompleto(profilo)}
                </span>
                <span className="block text-xs text-slate-400">
                  {ruolo ? RUOLO_LABEL[ruolo] : ''}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {menuAperto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAperto(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  <Link
                    to="/profilo"
                    className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuAperto(false)}
                  >
                    Il mio profilo
                  </Link>
                  <button
                    onClick={esci}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Esci
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-6 md:py-6 md:!pb-8"
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <BannerUrgenti />
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        {/* Barra inferiore (telefono): 4 voci fisse + "Altro", sempre a tutta
            larghezza senza scorrimento. Il padding rispetta la safe area iPhone. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {vociBarra.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `tabbar-item relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-[10px] font-medium leading-tight min-[360px]:text-[11px] ${
                  isActive && !altroAperto ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              <span className="relative">
                <v.icona className="h-6 w-6" />
                {v.to === '/chat' && <Contatore n={nChat} className="absolute -right-2.5 -top-1.5" />}
              </span>
              <span className="max-w-full truncate">{v.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setAltroAperto((a) => !a)}
            aria-expanded={altroAperto}
            className={`tabbar-item relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-[10px] font-medium leading-tight min-[360px]:text-[11px] ${
              altroAperto || inAltro ? 'text-brand-700' : 'text-slate-500'
            }`}
          >
            <span className="relative">
              {altroAperto ? <X className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
              {!altroAperto && <Contatore n={badgeAltro} className="absolute -right-2.5 -top-1.5" />}
            </span>
            <span>Altro</span>
          </button>
        </nav>

        {/* Foglio "Altro" */}
        {altroAperto && (
          <div className="md:hidden">
            <div className="fixed inset-0 z-20 bg-slate-900/30" onClick={() => setAltroAperto(false)} />
            <div
              className="fixed inset-x-0 z-20 rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-4 pt-3 shadow-2xl"
              style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
              role="dialog"
              aria-label="Altre sezioni"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
              <div className="grid grid-cols-3 gap-2">
                {vociAltro.map((v) => (
                  <TesseraAltro key={v.to} to={v.to} label={v.label} icona={v.icona} badge={v.to === '/chat' ? nChat : 0} />
                ))}
                <TesseraAltro to="/notifiche" label="Notifiche" icona={Bell} badge={nonLette.length} />
                <TesseraAltro to="/profilo" label="Profilo" icona={UserRound} />
                <TesseraAltro to="/impostazioni" label="Impostazioni" icona={Settings} />
                <button
                  onClick={() => {
                    setAltroAperto(false)
                    setGuidaAperta(true)
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium text-slate-600 active:bg-slate-100"
                >
                  <LifeBuoy className="h-6 w-6 text-slate-500" />
                  Guida
                </button>
              </div>
              <button
                onClick={esci}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-red-600 active:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Esci
              </button>
            </div>
          </div>
        )}
        <Guida aperto={guidaAperta} onClose={() => setGuidaAperta(false)} />
      </div>
    </div>
  )
}

function TesseraAltro({
  to,
  label,
  icona: Icona,
  badge = 0,
}: {
  to: string
  label: string
  icona: typeof LayoutDashboard
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs font-medium ${
          isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 active:bg-slate-100'
        }`
      }
    >
      <span className="relative">
        <Icona className="h-6 w-6" />
        <Contatore n={badge} className="absolute -right-2.5 -top-1.5" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  )
}
