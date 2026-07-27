-- ============================================================================
--  01_test_rls.sql — verifica automatica dell'isolamento multi-ASD e dei ruoli
--  Ogni controllo fallito interrompe l'esecuzione con errore.
-- ============================================================================

\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on
\pset format unaligned

-- ---------------------------------------------------------------------------
--  Helper di test (SECURITY INVOKER: le query girano con i permessi del ruolo
--  corrente, quindi RLS si applica davvero)
-- ---------------------------------------------------------------------------
create schema test;

create function test.verifica(p_label text, p_sql text, p_atteso int) returns void
  language plpgsql as $$
declare n int;
begin
  execute p_sql into n;
  if n is distinct from p_atteso then
    raise exception 'FALLITO: % -> atteso %, ottenuto %', p_label, p_atteso, n;
  end if;
  raise notice '  ok  % (= %)', p_label, n;
end $$;

create function test.vietato(p_label text, p_sql text) returns void
  language plpgsql as $$
begin
  execute p_sql;
  execute 'set constraints all immediate';   -- forza i trigger differiti
  raise exception 'FALLITO: % -> operazione CONSENTITA ma doveva essere vietata', p_label;
exception
  when others then
    if sqlstate = 'P0001' and sqlerrm like 'FALLITO%' then raise; end if;
    raise notice '  ok  % (respinto: %)', p_label, left(sqlerrm, 60);
end $$;

create function test.permesso(p_label text, p_sql text) returns void
  language plpgsql as $$
begin
  execute p_sql;
  execute 'set constraints all immediate';
  raise notice '  ok  % (consentito)', p_label;
end $$;

grant usage on schema test to authenticated;
grant execute on all functions in schema test to authenticated;


-- ===========================================================================
--  DATI DI PROVA  (inseriti come proprietario del database: RLS non si applica)
-- ===========================================================================

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001','prog@piattaforma.it'),
  ('a0000000-0000-4000-8000-000000000002','admin1@asda.it'),
  ('a0000000-0000-4000-8000-000000000003','admin2@asda.it'),
  ('a0000000-0000-4000-8000-000000000004','istruttore@asda.it'),
  ('a0000000-0000-4000-8000-000000000005','atleta1@asda.it'),
  ('a0000000-0000-4000-8000-000000000006','atleta2@asda.it'),
  ('a0000000-0000-4000-8000-000000000007','admin@asdb.it'),
  ('a0000000-0000-4000-8000-000000000008','atleta@asdb.it'),
  ('a0000000-0000-4000-8000-000000000009','nuova@asdc.it');

insert into asd (id, nome) values
  ('a5d0a5d0-0000-4000-8000-00000000000a','ASD Arcieri Alfa'),
  ('a5d0a5d0-0000-4000-8000-00000000000b','ASD Arcieri Beta');

insert into utenti (id, auth_id, ruolo, asd_id, nome, cognome, codice_fiscale) values
  ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','PROGRAMMATORE',      null,                                   'Omar','Sviluppatore', null),
  ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','AMMINISTRATORE_ASD','a5d0a5d0-0000-4000-8000-00000000000a','Anna','Rossi',   'RSSNNA80A41H501A'),
  ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','AMMINISTRATORE_ASD','a5d0a5d0-0000-4000-8000-00000000000a','Bruno','Bianchi','BNCBRN80A01H501B'),
  ('c0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','ISTRUTTORE',        'a5d0a5d0-0000-4000-8000-00000000000a','Carlo','Verdi',  'VRDCRL80A01H501C'),
  ('c0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','ATLETA',            'a5d0a5d0-0000-4000-8000-00000000000a','Dario','Neri',   'NREDRA00A01H501D'),
  ('c0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000006','ATLETA',            'a5d0a5d0-0000-4000-8000-00000000000a','Elena','Gialli', 'GLLLNE00A41H501E'),
  ('c0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000007','AMMINISTRATORE_ASD','a5d0a5d0-0000-4000-8000-00000000000b','Fabio','Blu',    'BLUFBA80A01H501F'),
  ('c0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000008','ATLETA',            'a5d0a5d0-0000-4000-8000-00000000000b','Gina','Viola',   'VLIGNA00A41H501G');

-- Documenti: 1 generale + 2 della ASD Alfa (uno pubblico, uno privato)
insert into documenti (id, titolo, scope, asd_id, visibilita, tipo, file_path, caricato_da, atleta_riferimento) values
  ('d0c00000-0000-4000-8000-000000000001','Linee guida nazionali CSAIN','GENERALE', null, null, 'REGOLAMENTO',
     'generale/linee-guida.pdf', 'c0000000-0000-4000-8000-000000000001', null),
  ('d0c00000-0000-4000-8000-000000000002','Programma corso base','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PUBBLICO','MATERIALE_CORSO',
     'asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/programma.pdf', 'c0000000-0000-4000-8000-000000000004', null),
  ('d0c00000-0000-4000-8000-000000000003','Nota riservata per Dario','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PRIVATO','GENERICO',
     'asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/privato-dario.pdf', 'c0000000-0000-4000-8000-000000000004', null);

-- Dario è destinatario del documento privato
insert into documento_atleti (documento_id, atleta_id, asd_id) values
  ('d0c00000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000005','a5d0a5d0-0000-4000-8000-00000000000a');

-- Corsi: uno in corso (Dario iscritto), uno aperto, uno in bozza
insert into corsi (id, asd_id, titolo, stato) values
  ('c0450000-0000-4000-8000-000000000001','a5d0a5d0-0000-4000-8000-00000000000a','Corso base 2026','IN_CORSO'),
  ('c0450000-0000-4000-8000-000000000002','a5d0a5d0-0000-4000-8000-00000000000a','Corso avanzato 2026','APERTO'),
  ('c0450000-0000-4000-8000-000000000003','a5d0a5d0-0000-4000-8000-00000000000a','Corso autunnale','BOZZA'),
  ('c0450000-0000-4000-8000-000000000004','a5d0a5d0-0000-4000-8000-00000000000b','Corso base Beta','IN_CORSO');

insert into giornate (id, corso_id, ordine, titolo) values
  ('61080000-0000-4000-8000-000000000001','c0450000-0000-4000-8000-000000000001',1,'Sicurezza e postura'),
  ('61080000-0000-4000-8000-000000000002','c0450000-0000-4000-8000-000000000001',2,'Primi tiri a 10m');

insert into iscrizioni (corso_id, atleta_id, stato) values
  ('c0450000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','ATTIVA');

insert into presenze (giornata_id, atleta_id, stato) values
  ('61080000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000005','PRESENTE');

-- Modulistica di piattaforma
insert into modelli_modulo (id, asd_id, codice, titolo) values
  ('30d00000-0000-4000-8000-000000000001', null, 'PRIVACY', 'Informativa e consenso privacy');

-- Modello di corso globale (alimenta la modalità guidata)
insert into modelli_corso (id, asd_id, titolo) values
  ('30de0000-0000-4000-8000-000000000001', null, 'Corso base 12 lezioni');
insert into modelli_giornata (modello_corso_id, ordine, titolo) values
  ('30de0000-0000-4000-8000-000000000001',1,'Sicurezza'),
  ('30de0000-0000-4000-8000-000000000001',2,'Postura'),
  ('30de0000-0000-4000-8000-000000000001',3,'Primi tiri');

-- File nel bucket, coerenti con i percorsi dei documenti
insert into storage.objects (bucket_id, name) values
  ('documenti','generale/linee-guida.pdf'),
  ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/programma.pdf'),
  ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/privato-dario.pdf');


-- ===========================================================================
--  TEST 1 — Visibilità dei documenti per ruolo
-- ===========================================================================
\echo '== 1. Visibilita documenti =='

set role authenticated;

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';  -- PROGRAMMATORE
select test.verifica('programmatore vede solo la doc. generale',
  'select count(*)::int from documenti', 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';  -- admin ASD Alfa
select test.verifica('amministratore Alfa vede tutti i doc. della sua ASD + generale',
  'select count(*)::int from documenti', 3);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore Alfa
select test.verifica('istruttore Alfa vede anche i documenti PRIVATI della sua ASD',
  'select count(*)::int from documenti where visibilita = ''PRIVATO''', 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';  -- atleta Dario (destinatario)
select test.verifica('atleta destinatario vede generale + pubblico + il suo privato',
  'select count(*)::int from documenti', 3);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- atleta Elena (non destinataria)
select test.verifica('atleta NON destinatario non vede il documento privato',
  'select count(*)::int from documenti', 2);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';  -- atleta ASD Beta
select test.verifica('atleta di altra ASD vede SOLO la documentazione generale',
  'select count(*)::int from documenti', 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000007';  -- admin ASD Beta
select test.verifica('amministratore Beta non vede nulla della ASD Alfa',
  'select count(*)::int from documenti where asd_id = ''a5d0a5d0-0000-4000-8000-00000000000a''', 0);


-- ===========================================================================
--  TEST 2 — Isolamento delle anagrafiche
-- ===========================================================================
\echo '== 2. Anagrafiche e privacy =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';  -- atleta
select test.verifica('un atleta vede solo la propria anagrafica',
  'select count(*)::int from utenti', 1);
select test.verifica('un atleta conosce lo staff della sua ASD tramite la vista',
  'select count(*)::int from v_staff_asd', 3);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore
select test.verifica('lo staff vede tutti i membri della propria ASD',
  'select count(*)::int from utenti', 5);
select test.verifica('lo staff non vede membri di altre ASD',
  'select count(*)::int from utenti where asd_id <> ''a5d0a5d0-0000-4000-8000-00000000000a''', 0);


-- ===========================================================================
--  TEST 3 — Chi può creare account
-- ===========================================================================
\echo '== 3. Creazione account =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore
select test.permesso('istruttore crea un ATLETA',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('ATLETA','a5d0a5d0-0000-4000-8000-00000000000a','Nuovo','Atleta')$$);
select test.vietato('istruttore NON puo creare un ISTRUTTORE',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('ISTRUTTORE','a5d0a5d0-0000-4000-8000-00000000000a','Tizio','Caio')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';  -- amministratore
select test.permesso('amministratore crea un ISTRUTTORE',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('ISTRUTTORE','a5d0a5d0-0000-4000-8000-00000000000a','Nuovo','Istruttore')$$);
select test.vietato('amministratore NON puo creare utenti in un''altra ASD',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('ATLETA','a5d0a5d0-0000-4000-8000-00000000000b','Intruso','Test')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';  -- atleta
select test.vietato('un atleta non puo creare account',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('ATLETA','a5d0a5d0-0000-4000-8000-00000000000a','Fantasma','Test')$$);


-- ===========================================================================
--  TEST 4 — Nessuna auto-promozione
-- ===========================================================================
\echo '== 4. Escalation privilegi =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
select test.permesso('l''atleta aggiorna i propri recapiti',
  $$update utenti set telefono = '3330000000' where id = 'c0000000-0000-4000-8000-000000000005'$$);
select test.vietato('l''atleta NON puo promuoversi ad amministratore',
  $$update utenti set ruolo = 'AMMINISTRATORE_ASD' where id = 'c0000000-0000-4000-8000-000000000005'$$);
select test.vietato('l''atleta NON puo spostarsi in un''altra ASD',
  $$update utenti set asd_id = 'a5d0a5d0-0000-4000-8000-00000000000b' where id = 'c0000000-0000-4000-8000-000000000005'$$);


-- ===========================================================================
--  TEST 5 — Più amministratori per ASD, ma mai zero
-- ===========================================================================
\echo '== 5. Amministratori multipli =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';  -- admin1
select test.verifica('la ASD Alfa ha due amministratori attivi',
  'select count(*)::int from utenti where ruolo = ''AMMINISTRATORE_ASD'' and attivo', 2);
select test.permesso('un amministratore puo disattivarne un altro (ne resta uno)',
  $$update utenti set attivo = false where id = 'c0000000-0000-4000-8000-000000000003'$$);
select test.vietato('nessuno modifica ruolo/attivazione del PROPRIO profilo',
  $$update utenti set attivo = false where id = 'c0000000-0000-4000-8000-000000000002'$$);
select test.vietato('non e possibile lasciare la ASD senza amministratori',
  $$delete from utenti where id = 'c0000000-0000-4000-8000-000000000002'$$);
-- ripristino
reset role;
set request.jwt.claim.sub = '';
update utenti set attivo = true where id = 'c0000000-0000-4000-8000-000000000003';
set role authenticated;


-- ===========================================================================
--  TEST 6 — Documenti: caricamento e confini
-- ===========================================================================
\echo '== 6. Caricamento documenti =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- atleta Elena
select test.permesso('l''atleta carica il PROPRIO certificato medico',
  $$insert into documenti (titolo, scope, asd_id, visibilita, tipo, file_path,
                           atleta_riferimento, caricato_da)
    values ('Certificato medico Elena','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PRIVATO',
            'CERTIFICATO_MEDICO',
            'asd/a5d0a5d0-0000-4000-8000-00000000000a/atleti/c0000000-0000-4000-8000-000000000006/cert.pdf',
            'c0000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000006')$$);

select test.vietato('l''atleta NON puo pubblicare documenti per tutta la ASD',
  $$insert into documenti (titolo, scope, asd_id, visibilita, tipo, file_path, caricato_da)
    values ('Falso avviso','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PUBBLICO','GENERICO',
            'asd/a5d0a5d0-0000-4000-8000-00000000000a/atleti/x/fake.pdf',
            'c0000000-0000-4000-8000-000000000006')$$);

select test.vietato('l''atleta NON puo caricare documenti a nome di un altro atleta',
  $$insert into documenti (titolo, scope, asd_id, visibilita, tipo, file_path,
                           atleta_riferimento, caricato_da)
    values ('Cert. altrui','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PRIVATO','CERTIFICATO_MEDICO',
            'asd/a5d0a5d0-0000-4000-8000-00000000000a/atleti/altro/cert.pdf',
            'c0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000006')$$);

select test.vietato('nessuno tranne i PROGRAMMATORI pubblica documentazione generale',
  $$insert into documenti (titolo, scope, file_path)
    values ('Falsa linea guida','GENERALE','generale/falso.pdf')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore Alfa
select test.verifica('lo staff vede subito il certificato caricato dall''atleta',
  'select count(*)::int from documenti where tipo = ''CERTIFICATO_MEDICO''', 1);
select test.vietato('lo staff NON puo caricare documenti in un''altra ASD',
  $$insert into documenti (titolo, scope, asd_id, visibilita, tipo, file_path)
    values ('Intrusione','ASD','a5d0a5d0-0000-4000-8000-00000000000b','PUBBLICO','GENERICO',
            'asd/a5d0a5d0-0000-4000-8000-00000000000b/staff/x.pdf')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000007';  -- admin Beta
select test.verifica('un update cross-ASD non tocca alcuna riga',
  $$with u as (update documenti set titolo = 'compromesso'
               where asd_id = 'a5d0a5d0-0000-4000-8000-00000000000a' returning 1)
    select count(*)::int from u$$, 0);


-- ===========================================================================
--  TEST 7 — Corsi, giornate, presenze
-- ===========================================================================
\echo '== 7. Corsi e presenze =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';  -- Dario, iscritto
select test.verifica('l''atleta vede il corso a cui e iscritto e quelli aperti',
  'select count(*)::int from corsi', 2);
select test.verifica('l''atleta vede le giornate del proprio corso',
  'select count(*)::int from giornate', 2);
select test.verifica('l''atleta vede solo le proprie presenze',
  'select count(*)::int from presenze', 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- Elena, non iscritta
select test.verifica('un atleta non iscritto vede solo i corsi aperti',
  'select count(*)::int from corsi', 1);
select test.verifica('un atleta non iscritto non vede le giornate altrui',
  'select count(*)::int from giornate', 0);
select test.verifica('un atleta non vede le presenze di altri',
  'select count(*)::int from presenze', 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';  -- atleta Beta
select test.verifica('nessuna visibilita sui corsi di un''altra ASD',
  'select count(*)::int from corsi', 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore Alfa
select test.verifica('lo staff vede tutti i corsi della propria ASD',
  'select count(*)::int from corsi', 3);


-- ===========================================================================
--  TEST 8 — Storage: i file seguono la visibilità dei documenti
-- ===========================================================================
\echo '== 8. Storage =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';  -- atleta Beta
select test.verifica('scarica solo il file della documentazione generale',
  'select count(*)::int from storage.objects', 1);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- atleta Elena
select test.verifica('vede generale + pubblico (non il privato altrui)',
  'select count(*)::int from storage.objects', 2);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore
select test.verifica('lo staff accede a tutti i file della propria ASD',
  'select count(*)::int from storage.objects', 3);
select test.permesso('lo staff carica nella cartella della propria ASD',
  $$insert into storage.objects (bucket_id, name)
    values ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/nuovo.pdf')$$);
select test.vietato('lo staff NON carica nella cartella di un''altra ASD',
  $$insert into storage.objects (bucket_id, name)
    values ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000b/staff/intruso.pdf')$$);
select test.vietato('lo staff NON pubblica nella cartella generale',
  $$insert into storage.objects (bucket_id, name)
    values ('documenti','generale/abusivo.pdf')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- atleta Elena
select test.permesso('l''atleta carica nella propria cartella personale',
  $$insert into storage.objects (bucket_id, name)
    values ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000a/atleti/c0000000-0000-4000-8000-000000000006/nuovo.pdf')$$);
select test.vietato('l''atleta NON carica nella cartella di un altro atleta',
  $$insert into storage.objects (bucket_id, name)
    values ('documenti','asd/a5d0a5d0-0000-4000-8000-00000000000a/atleti/c0000000-0000-4000-8000-000000000005/furbo.pdf')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';  -- programmatore
select test.permesso('il programmatore pubblica documentazione generale',
  $$insert into storage.objects (bucket_id, name) values ('documenti','generale/manuale.pdf')$$);


-- ===========================================================================
--  TEST 9 — Onboarding di una nuova ASD (nessun database da creare)
-- ===========================================================================
\echo '== 9. Registrazione nuova ASD =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000009';
select test.verifica('un utente senza profilo non vede alcuna ASD',
  'select count(*)::int from asd', 0);
select test.permesso('registrazione automatica di una nuova ASD',
  $$select registra_asd('ASD Arcieri Gamma','Giulia','Neri','CSAIN-123')$$);
select test.verifica('il fondatore diventa amministratore della sua ASD',
  'select count(*)::int from utenti where ruolo = ''AMMINISTRATORE_ASD''', 1);
select test.verifica('e vede soltanto la propria ASD',
  'select count(*)::int from asd', 1);
select test.vietato('non e possibile registrare due volte lo stesso account',
  $$select registra_asd('ASD Doppione','Giulia','Neri')$$);


-- ===========================================================================
--  TEST 10 — Modalità guidata: corso generato da modello
-- ===========================================================================
\echo '== 10. Composizione guidata del corso =='

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore Alfa
select test.verifica('le linee guida di piattaforma sono visibili a tutte le ASD',
  'select count(*)::int from modelli_corso where asd_id is null', 1);
select test.permesso('generazione guidata del corso dal modello',
  $$select crea_corso_da_modello('30de0000-0000-4000-8000-000000000001','Corso base autunno','2026-09-15')$$);
select test.verifica('il corso generato contiene le 3 giornate del modello',
  $$select count(*)::int from giornate g join corsi c on c.id = g.corso_id
    where c.titolo = 'Corso base autunno'$$, 3);
select test.verifica('le giornate sono programmate a cadenza settimanale',
  $$select count(*)::int from giornate g join corsi c on c.id = g.corso_id
    where c.titolo = 'Corso base autunno' and g.data = date '2026-09-29' and g.ordine = 3$$, 1);
select test.verifica('il corso generato appartiene alla ASD dell''istruttore',
  $$select count(*)::int from corsi
    where titolo = 'Corso base autunno' and asd_id = 'a5d0a5d0-0000-4000-8000-00000000000a'$$, 1);


-- ===========================================================================
--  TEST 11 — Regressioni: falle individuate in revisione e corrette
-- ===========================================================================
\echo '== 11. Regressioni di sicurezza =='

-- 11.1 un amministratore non si auto-promuove a PROGRAMMATORE
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
select test.vietato('un amministratore NON puo auto-promuoversi a PROGRAMMATORE',
  $$update utenti set ruolo = 'PROGRAMMATORE', asd_id = null
     where id = 'c0000000-0000-4000-8000-000000000002'$$);
select test.vietato('un amministratore NON puo trasferirsi in un''altra ASD',
  $$update utenti set asd_id = 'a5d0a5d0-0000-4000-8000-00000000000b'
     where id = 'c0000000-0000-4000-8000-000000000002'$$);
select test.vietato('un amministratore NON puo riassegnare l''account di un altro profilo',
  $$update utenti set auth_id = 'a0000000-0000-4000-8000-000000000009'
     where id = 'c0000000-0000-4000-8000-000000000004'$$);

-- 11.2 nessuno cambia il proprio collegamento all'account
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
select test.vietato('un atleta NON puo ripuntare il profilo su un altro account',
  $$update utenti set auth_id = 'a0000000-0000-4000-8000-000000000009'
     where id = 'c0000000-0000-4000-8000-000000000005'$$);

-- 11.3 i percorsi dei file non sono rivendicabili
select test.vietato('un atleta NON puo registrare il percorso di un file dello staff',
  $$insert into documenti (titolo, scope, asd_id, visibilita, tipo, file_path,
                           atleta_riferimento, caricato_da)
    values ('Furto','ASD','a5d0a5d0-0000-4000-8000-00000000000a','PRIVATO','GENERICO',
            'asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/privato-dario.pdf',
            'c0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000005')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';  -- atleta ASD Beta
select test.vietato('un modulo NON puo puntare al file di un''altra ASD',
  $$insert into moduli_compilati (modello_id, asd_id, atleta_id, pdf_path)
    values ('30d00000-0000-4000-8000-000000000001','a5d0a5d0-0000-4000-8000-00000000000b',
            'c0000000-0000-4000-8000-000000000008',
            'asd/a5d0a5d0-0000-4000-8000-00000000000a/staff/privato-dario.pdf')$$);

-- 11.4 l'atleta non si auto-attesta la firma dei moduli
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
select test.vietato('un atleta NON puo dichiarare firmato un modulo',
  $$insert into moduli_compilati (modello_id, asd_id, atleta_id, stato, firmato_il)
    values ('30d00000-0000-4000-8000-000000000001','a5d0a5d0-0000-4000-8000-00000000000a',
            'c0000000-0000-4000-8000-000000000005','FIRMATO', now())$$);
select test.permesso('un atleta puo compilare il modulo in BOZZA',
  $$insert into moduli_compilati (modello_id, asd_id, atleta_id)
    values ('30d00000-0000-4000-8000-000000000001','a5d0a5d0-0000-4000-8000-00000000000a',
            'c0000000-0000-4000-8000-000000000005')$$);

-- 11.5 iscrizione solo a corsi aperti
select test.vietato('un atleta NON puo iscriversi a un corso in bozza',
  $$insert into iscrizioni (corso_id, atleta_id, stato)
    values ('c0450000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000005','RICHIESTA')$$);

-- 11.6 i codici di invito verso profili amministratore sono invisibili agli istruttori
reset role;
set request.jwt.claim.sub = '';
insert into utenti (id, ruolo, asd_id, nome, cognome)
  values ('c0000000-0000-4000-8000-0000000000aa','AMMINISTRATORE_ASD',
          'a5d0a5d0-0000-4000-8000-00000000000a','Futuro','Amministratore');
insert into inviti (utente_id) values ('c0000000-0000-4000-8000-0000000000aa');
set role authenticated;

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore
select test.verifica('l''istruttore non vede gli inviti verso amministratori',
  $$select count(*)::int from inviti where utente_id = 'c0000000-0000-4000-8000-0000000000aa'$$, 0);
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';  -- amministratore
select test.verifica('l''amministratore vede l''invito che ha generato',
  $$select count(*)::int from inviti where utente_id = 'c0000000-0000-4000-8000-0000000000aa'$$, 1);

-- 11.7 un amministratore "fantoccio" mai attivato non soddisfa il vincolo
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000007';  -- unico admin di Beta
select test.permesso('l''amministratore crea un secondo profilo amministratore',
  $$insert into utenti (ruolo, asd_id, nome, cognome)
    values ('AMMINISTRATORE_ASD','a5d0a5d0-0000-4000-8000-00000000000b','Fantoccio','Admin')$$);
select test.vietato('un amministratore mai attivato non conta come amministratore',
  $$delete from utenti where id = 'c0000000-0000-4000-8000-000000000007'$$);

-- 11.8 un nome di file fuori convenzione non blocca l'intero bucket
reset role;
set request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name) values ('documenti','asd/.emptyFolderPlaceholder');
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';
select test.permesso('un oggetto con nome irregolare non manda in errore le policy',
  $$delete from storage.objects where bucket_id = 'documenti' and name like 'asd/%nonesistente%'$$);

-- 11.9 un utente disattivato perde ogni accesso, anche alla doc. generale
reset role;
set request.jwt.claim.sub = '';
update utenti set attivo = false where id = 'c0000000-0000-4000-8000-000000000006';
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';  -- Elena, disattivata
select test.verifica('un utente disattivato non vede alcun documento',
  'select count(*)::int from documenti', 0);
select test.verifica('un utente disattivato non vede alcun file',
  'select count(*)::int from storage.objects', 0);
select test.verifica('un utente disattivato non vede i modelli di piattaforma',
  'select count(*)::int from modelli_corso', 0);


-- ===========================================================================
--  TEST 12 — Regressioni del secondo giro di revisione
-- ===========================================================================
\echo '== 12. Seconda revisione =='

-- 12.1 il collegamento all'account non dipende da un flag impostabile dal client
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
set app.collega_account = '1';
select test.vietato('un flag di sessione non sblocca la modifica di auth_id',
  $$update utenti set auth_id = 'a0000000-0000-4000-8000-0000000000fe'
     where id = 'c0000000-0000-4000-8000-000000000005'$$);
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
select test.vietato('nemmeno un amministratore puo sganciare l''account altrui',
  $$update utenti set auth_id = null where id = 'c0000000-0000-4000-8000-000000000003'$$);
reset app.collega_account;

-- 12.2 la ASD non si blocca: la cancellazione dell'account dell'ultimo
--      amministratore viene rifiutata, non subita
reset role;
set request.jwt.claim.sub = '';
select test.vietato('non si puo cancellare l''account dell''unico amministratore',
  $$delete from auth.users where id = 'a0000000-0000-4000-8000-000000000007'$$);
select test.permesso('la ASD resta operativa dopo il tentativo fallito',
  $$update utenti set telefono = '3331112222' where id = 'c0000000-0000-4000-8000-000000000007'$$);

-- ...ma con un successore invitato la cancellazione dell'account (diritto
-- all'oblio) deve poter avvenire: un profilo con invito valido è "attivabile".
insert into inviti (utente_id)
  select id from utenti where asd_id = 'a5d0a5d0-0000-4000-8000-00000000000b'
    and ruolo = 'AMMINISTRATORE_ASD' and auth_id is null;
select test.permesso('con un successore invitato l''account puo essere cancellato',
  $$delete from auth.users where id = 'a0000000-0000-4000-8000-000000000007'$$);
set role authenticated;

-- 12.3 la data di firma è generata dal server
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';
select test.permesso('l''atleta invia il modulo compilato',
  $$update moduli_compilati set stato = 'INVIATO', firmato_il = now()
     where atleta_id = app.mio_id()$$);
select test.verifica('l''atleta non puo auto-attestarsi la firma',
  $$select count(*)::int from moduli_compilati
     where atleta_id = app.mio_id() and firmato_il is not null$$, 0);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';  -- istruttore
select test.permesso('lo staff valida e firma il modulo',
  $$update moduli_compilati set stato = 'FIRMATO'
     where atleta_id = 'c0000000-0000-4000-8000-000000000005'$$);
select test.verifica('la firma viene datata dal server',
  $$select count(*)::int from moduli_compilati
     where stato = 'FIRMATO' and firmato_il is not null$$, 1);

-- 12.4 tracciabilità: non si riscrive la propria riga con DELETE+INSERT
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000002';
select test.vietato('un amministratore non puo cancellare il proprio profilo',
  $$with d as (delete from utenti where id = 'c0000000-0000-4000-8000-000000000002'
               returning asd_id)
    insert into utenti (auth_id, ruolo, asd_id, nome, cognome)
      select 'a0000000-0000-4000-8000-000000000002','AMMINISTRATORE_ASD',asd_id,'Anna','Rossi' from d$$);
select test.vietato('il codice fiscale non e riscrivibile con una UPDATE diretta',
  $$update utenti set codice_fiscale = 'XXXXXX00X00X000X'
     where id = 'c0000000-0000-4000-8000-000000000002'$$);
select test.permesso('lo staff corregge il codice fiscale tramite la RPC dedicata',
  $$select aggiorna_dati_anagrafici('c0000000-0000-4000-8000-000000000005','NREDRA00A01H501Z')$$);

set request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000005';  -- atleta
select test.vietato('un atleta non puo usare la RPC su un altro utente',
  $$select aggiorna_dati_anagrafici('c0000000-0000-4000-8000-000000000002','ZZZZZZ00Z00Z000Z')$$);

-- 12.5 il tipo uuid non è ombreggiabile per neutralizzare le policy
create temp table uuid (x int);
select test.verifica('app.uuid_o_null resiste allo shadowing del tipo uuid',
  $$select (app.uuid_o_null('a5d0a5d0-0000-4000-8000-00000000000a') is not null)::int$$, 1);
drop table uuid;

reset role;
\echo ''
\echo '=============================================='
\echo ' TUTTI I CONTROLLI SUPERATI'
\echo '=============================================='
