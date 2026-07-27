import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  FileText,
  ClipboardList,
  MessageCircle,
  Users,
  Award,
  LogOut,
  Target,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui'
import { GuidaButton } from '@/components/Guida'
import { getLogoCsain } from '@/api/piattaforma'
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
]

export default function Layout() {
  const { profilo, asd, ruolo, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuAperto, setMenuAperto] = useState(false)
  const { data: logoCsain } = useQuery({ queryKey: ['logo-csain'], queryFn: getLogoCsain })

  const voci = NAV.filter((v) => !v.soloRuoli || (ruolo && v.soloRuoli.includes(ruolo)))

  async function esci() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          {logoCsain && <img src={logoCsain} alt="CSAIN" className="h-8 w-8 object-contain" />}
          {asd?.logo ? (
            <img src={asd.logo} alt="Logo" className="h-8 w-8 rounded object-contain" />
          ) : (
            <Target className="h-7 w-7 text-brand-700" />
          )}
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">{asd?.nome ?? 'IstruttoriCSAIn'}</p>
            <p className="text-xs text-slate-400">Gestione corsi ASD</p>
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
              {v.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="truncate text-xs font-medium text-slate-500">{asd?.nome ?? 'Piattaforma'}</p>
          </div>
        </div>
      </aside>

      {/* Colonna principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            {logoCsain && <img src={logoCsain} alt="CSAIN" className="h-7 w-7 object-contain" />}
            {asd?.logo ? (
              <img src={asd.logo} alt="Logo" className="h-7 w-7 rounded object-contain" />
            ) : (
              <Target className="h-6 w-6 text-brand-700" />
            )}
            <span className="truncate font-bold text-slate-900">{asd?.nome ?? 'IstruttoriCSAIn'}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm text-slate-400">{asd?.nome ?? 'Area piattaforma'}</p>
          </div>

          <div className="flex items-center gap-1">
          <Link to="/impostazioni" className="icon-btn" aria-label="Impostazioni" title="Impostazioni">
            <Settings className="h-5 w-5" />
          </Link>
          <GuidaButton />
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white md:hidden">
          {voci.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `tabbar-item flex min-w-[3.9rem] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-brand-700' : 'text-slate-400'
                }`
              }
            >
              <v.icona className="h-5 w-5" />
              {v.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
