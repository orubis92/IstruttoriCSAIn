import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireProfilo, RequireSessione } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Benvenuto from '@/pages/Benvenuto'
import NonTrovato from '@/pages/NonTrovato'
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Profilo = lazy(() => import('@/pages/Profilo'))
const Membri = lazy(() => import('@/pages/Membri'))
const Corsi = lazy(() => import('@/pages/Corsi'))
const Calendario = lazy(() => import('@/pages/Calendario'))
const CorsoNuovo = lazy(() => import('@/pages/CorsoNuovo'))
const CorsoDettaglio = lazy(() => import('@/pages/CorsoDettaglio'))
const DiplomiCorso = lazy(() => import('@/pages/DiplomiCorso'))
const Documenti = lazy(() => import('@/pages/Documenti'))
const Moduli = lazy(() => import('@/pages/Moduli'))
const Chat = lazy(() => import('@/pages/Chat'))
const Standard = lazy(() => import('@/pages/Standard'))
const Piattaforma = lazy(() => import('@/pages/Piattaforma'))
const Notifiche = lazy(() => import('@/pages/Notifiche'))
const Impostazioni = lazy(() => import('@/pages/Impostazioni'))
const Registro = lazy(() => import('@/pages/Registro'))
import { isSupabaseConfigured } from '@/lib/supabase'
import { Alert, PageLoader } from '@/components/ui'

export default function App() {
  return (
    <>
      {!isSupabaseConfigured && (
        <div className="p-4">
          <Alert tono="giallo">
            Configurazione Supabase mancante: copia <code>.env.example</code> in <code>.env</code> e
            inserisci <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>, poi riavvia.
          </Alert>
        </div>
      )}
      {/* Le pagine si caricano su richiesta (code splitting): il primo avvio è più leggero.
          Dentro il layout c'è un secondo Suspense, così barra e menù restano visibili. */}
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/benvenuto"
          element={
            <RequireSessione>
              <Benvenuto />
            </RequireSessione>
          }
        />

        <Route
          element={
            <RequireProfilo>
              <Layout />
            </RequireProfilo>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/profilo" element={<Profilo />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="/registro-accessi" element={<Registro />} />
          <Route path="/membri" element={<Membri />} />
          <Route path="/corsi" element={<Corsi />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/corsi/nuovo" element={<CorsoNuovo />} />
          <Route path="/corsi/:id" element={<CorsoDettaglio />} />
          <Route path="/documenti" element={<Documenti />} />
          <Route path="/moduli" element={<Moduli />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/standard" element={<Standard />} />
          <Route path="/piattaforma" element={<Piattaforma />} />
          <Route path="/notifiche" element={<Notifiche />} />
        </Route>

        {/* Pagina di stampa dei diplomi: fuori dal layout per una stampa pulita */}
        <Route
          path="/corsi/:id/diplomi"
          element={
            <RequireProfilo>
              <DiplomiCorso />
            </RequireProfilo>
          }
        />

        <Route path="/404" element={<NonTrovato />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
