-- ============================================================================
--  02_test_estensioni.sql — test delle estensioni (migrazioni 12,13,14):
--    validità/stato certificati, gestione minori, registro accessi art.9.
--
--  Da eseguire nella STESSA sessione psql dopo 01_test_rls.sql: riusa gli helper
--  test.* e i dati di prova già inseriti (ASD Alfa/Beta, Dario, Elena, ...).
--  \set ON_ERROR_STOP on è già attivo dal file precedente.
-- ============================================================================

\echo ''
\echo '== 13. Certificati: validità, stato e vista =='

-- Dati come proprietario (RLS non si applica). Azzeriamo eventuali residui e il
-- registro accessi, così i conteggi sono deterministici.
reset role;
set request.jwt.claim.sub = '';
-- Elena è stata disattivata da un test precedente: la riattiviamo, così rientra
-- tra gli atleti attivi (la vista, correttamente, esclude quelli disattivati).
update utenti set attivo = true
 where id in ('c0000000-0000-4000-8000-000000000005',
              'c0000000-0000-4000-8000-000000000006');
delete from certificati_medici
 where atleta_id in ('c0000000-0000-4000-8000-000000000005',
                     'c0000000-0000-4000-8000-000000000006');
delete from audit_accessi;
set role authenticated;

-- Lo staff registra i certificati (l'inserimento genera anche l'audit CREAZIONE).
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';   -- istruttore Alfa
select test.permesso('staff registra un certificato VALIDO per Dario',
  $$insert into certificati_medici (atleta_id, asd_id, tipo, data_scadenza)
    values ('c0000000-0000-4000-8000-000000000005','a5d0a5d0-0000-4000-8000-00000000000a','NON_AGONISTICO', current_date + 200)$$);
select test.permesso('staff registra un certificato SCADUTO per Elena',
  $$insert into certificati_medici (atleta_id, asd_id, tipo, data_scadenza)
    values ('c0000000-0000-4000-8000-000000000006','a5d0a5d0-0000-4000-8000-00000000000a','NON_AGONISTICO', current_date - 5)$$);

select test.verifica('Dario ha un certificato valido',
  $$select app.atleta_ha_certificato_valido('c0000000-0000-4000-8000-000000000005')::int$$, 1);
select test.verifica('Elena NON ha un certificato valido',
  $$select app.atleta_ha_certificato_valido('c0000000-0000-4000-8000-000000000006')::int$$, 0);

select test.verifica('lo staff vede lo stato VALIDO di Dario nella vista',
  $$select count(*)::int from v_certificati_atleti
     where atleta_id = 'c0000000-0000-4000-8000-000000000005' and stato = 'VALIDO'$$, 1);
select test.verifica('lo staff vede lo stato SCADUTO di Elena nella vista',
  $$select count(*)::int from v_certificati_atleti
     where atleta_id = 'c0000000-0000-4000-8000-000000000006' and stato = 'SCADUTO'$$, 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';   -- atleta Elena
select test.verifica('l''atleta vede solo il proprio stato certificato',
  $$select count(*)::int from v_certificati_atleti$$, 1);
select test.verifica('l''atleta non vede lo stato di un altro atleta',
  $$select count(*)::int from v_certificati_atleti
     where atleta_id = 'c0000000-0000-4000-8000-000000000005'$$, 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';   -- atleta ASD Beta
select test.verifica('atleta di altra ASD non vede i certificati della ASD Alfa',
  $$select count(*)::int from v_certificati_atleti
     where atleta_id in ('c0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000006')$$, 0);


\echo ''
\echo '== 14. Minori e consenso del genitore =='

select test.verifica('e_minorenne riconosce un nato nel 2015',
  $$select app.e_minorenne(date '2015-06-01')::int$$, 1);
select test.verifica('e_minorenne esclude un nato nel 1980',
  $$select app.e_minorenne(date '1980-06-01')::int$$, 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';   -- istruttore Alfa
select test.permesso('lo staff crea un atleta minorenne con i dati del genitore',
  $$insert into utenti (ruolo, asd_id, nome, cognome, data_nascita,
                        genitore_nome, genitore_cognome, genitore_relazione, genitore_email)
    values ('ATLETA','a5d0a5d0-0000-4000-8000-00000000000a','Piccolo','Arciere', date '2015-06-01',
            'Mario','Rossi','Genitore','mario@example.it')$$);
select test.verifica('i dati del genitore risultano salvati',
  $$select count(*)::int from utenti where nome = 'Piccolo' and genitore_nome = 'Mario'$$, 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';   -- atleta Dario (ha un account)
select test.permesso('registrazione del consenso per conto di un minore',
  $$insert into consensi_privacy (utente_id, versione, per_minore, firmatario_nome, firmatario_relazione)
    values ('c0000000-0000-4000-8000-000000000005', 99, true, 'Padre di Dario', 'Genitore')$$);
select test.verifica('il consenso conserva il firmatario',
  $$select count(*)::int from consensi_privacy
     where utente_id = 'c0000000-0000-4000-8000-000000000005' and versione = 99
       and per_minore and firmatario_nome is not null$$, 1);


\echo ''
\echo '== 15. Registro accessi ai dati sanitari (art.9) =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';   -- istruttore Alfa
select test.verifica('le due creazioni di certificato sono tracciate',
  $$select count(*)::int from audit_accessi
     where azione = 'CREAZIONE' and oggetto_tipo = 'CERTIFICATO_MEDICO'$$, 2);

select test.permesso('lo staff legge i certificati tramite la RPC dedicata',
  $$select * from leggi_certificati_atleta('c0000000-0000-4000-8000-000000000005')$$);
select test.verifica('la lettura dello staff su un altro atleta è registrata',
  $$select count(*)::int from audit_accessi
     where azione = 'LETTURA' and atleta_id = 'c0000000-0000-4000-8000-000000000005'$$, 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';   -- atleta Dario
select test.permesso('l''atleta legge i propri certificati tramite la RPC',
  $$select * from leggi_certificati_atleta('c0000000-0000-4000-8000-000000000005')$$);
select test.vietato('un atleta non puo leggere i certificati di un altro',
  $$select * from leggi_certificati_atleta('c0000000-0000-4000-8000-000000000006')$$);
select test.verifica('un atleta non vede il registro accessi',
  $$select count(*)::int from audit_accessi$$, 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';   -- istruttore Alfa
select test.verifica('la lettura dei PROPRI dati (dell''atleta) non ha aggiunto righe',
  $$select count(*)::int from audit_accessi
     where azione = 'LETTURA' and atleta_id = 'c0000000-0000-4000-8000-000000000005'$$, 1);
select test.verifica('lo staff Alfa vede il proprio registro accessi',
  $$select (count(*) > 0)::int from audit_accessi$$, 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000007';   -- amministratore ASD Beta
select test.verifica('l''amministratore Beta non vede gli accessi della ASD Alfa',
  $$select count(*)::int from audit_accessi
     where asd_id = 'a5d0a5d0-0000-4000-8000-00000000000a'$$, 0);


\echo ''
\echo '== 16. Chat: eliminazione ed uscita =='

-- Dati come proprietario: un gruppo (creato dall'istruttore) con istruttore,
-- Dario e l'amministratrice Anna; un secondo gruppo per il test amministratore;
-- una chat diretta istruttore–Dario.
reset role;
set request.jwt.claim.sub = '';
insert into conversazioni (id, tipo, nome, asd_id, creato_da) values
  ('cafe0000-0000-4000-8000-000000000001','GRUPPO','Gruppo Test', 'a5d0a5d0-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000004'),
  ('cafe0000-0000-4000-8000-000000000002','GRUPPO','Gruppo Admin','a5d0a5d0-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000004'),
  ('cafe0000-0000-4000-8000-000000000003','DIRETTA', null, null, 'c0000000-0000-4000-8000-000000000004');
insert into conversazione_membri (conversazione_id, utente_id) values
  ('cafe0000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000004'),
  ('cafe0000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005'),
  ('cafe0000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002'),
  ('cafe0000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004'),
  ('cafe0000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002'),
  ('cafe0000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000004'),
  ('cafe0000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000005');
set role authenticated;

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';   -- atleta ASD Beta (estraneo)
select test.vietato('un estraneo non puo eliminare una conversazione',
  $$select elimina_conversazione('cafe0000-0000-4000-8000-000000000001')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';   -- Dario, membro non creatore
select test.vietato('un membro non creatore non puo eliminare il gruppo',
  $$select elimina_conversazione('cafe0000-0000-4000-8000-000000000001')$$);
select test.permesso('un membro puo uscire dal gruppo',
  $$select esci_da_conversazione('cafe0000-0000-4000-8000-000000000001')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';   -- istruttore (creatore)
select test.verifica('dopo l''uscita il gruppo ha un membro in meno',
  $$select count(*)::int from conversazione_membri
     where conversazione_id = 'cafe0000-0000-4000-8000-000000000001'$$, 2);
select test.permesso('il creatore elimina il gruppo',
  $$select elimina_conversazione('cafe0000-0000-4000-8000-000000000001')$$);

reset role;
set request.jwt.claim.sub = '';
select test.verifica('il gruppo eliminato non esiste piu',
  $$select count(*)::int from conversazioni where id = 'cafe0000-0000-4000-8000-000000000001'$$, 0);
select test.verifica('i membri del gruppo eliminato sono rimossi a cascata',
  $$select count(*)::int from conversazione_membri
     where conversazione_id = 'cafe0000-0000-4000-8000-000000000001'$$, 0);
set role authenticated;

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';   -- amministratrice Anna
select test.permesso('un amministratore elimina un gruppo che non ha creato',
  $$select elimina_conversazione('cafe0000-0000-4000-8000-000000000002')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';   -- Dario, partecipante alla diretta
select test.permesso('un partecipante elimina la chat diretta',
  $$select elimina_conversazione('cafe0000-0000-4000-8000-000000000003')$$);

reset role;
set request.jwt.claim.sub = '';
select test.verifica('la chat diretta eliminata non esiste piu',
  $$select count(*)::int from conversazioni where id = 'cafe0000-0000-4000-8000-000000000003'$$, 0);

reset role;
\echo ''
\echo '=============================================='
\echo ' ESTENSIONI: TUTTI I CONTROLLI SUPERATI'
\echo '=============================================='
