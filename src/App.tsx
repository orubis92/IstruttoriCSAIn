import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireProfilo, RequireSessione } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Benvenuto from '@/pages/Benvenuto'
import Dashboard from '@/pages/Dashboard'
import Profilo from '@/pages/Profilo'
import Membri from '@/pages/Membri'
import Corsi from '@/pages/Corsi'
import Calendario from '@/pages/Calendario'
import CorsoNuovo from '@/pages/CorsoNuovo'
import CorsoDettaglio from '@/pages/CorsoDettaglio'
import DiplomiCorso from '@/pages/DiplomiCorso'
import Documenti from '@/pages/Documenti'
import Moduli from '@/pages/Moduli'
import Chat from '@/pages/Chat'
import Standard from '@/pages/Standard'
import Impostazioni from '@/pages/Impostazioni'
import NonTrovato from '@/pages/NonTrovato'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Alert } from '@/components/ui'

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
      <Routes>
        <Route path="/login" element={<Login />} />
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
          <Route path="/membri" element={<Membri />} />
          <Route path="/corsi" element={<Corsi />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/corsi/nuovo" element={<CorsoNuovo />} />
          <Route path="/corsi/:id" element={<CorsoDettaglio />} />
          <Route path="/documenti" element={<Documenti />} />
          <Route path="/moduli" element={<Moduli />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/standard" element={<Standard />} />
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
    </>
  )
}
