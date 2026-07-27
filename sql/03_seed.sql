-- ============================================================================
--  03_seed.sql — dati di base pronti all'uso (opzionale)
--
--  Inserisce, a livello di PIATTAFORMA (asd_id = NULL), quindi disponibili a
--  TUTTE le ASD:
--    - due linee guida di corso (Base e Intermedio) con le loro giornate;
--    - tre moduli pronti: iscrizione al corso, consenso privacy, autocertificazione
--      dello stato di salute.
--
--  Eseguibile una sola volta oppure più volte: usa UUID fissi con
--  "on conflict do nothing", quindi non crea duplicati se rilanciato.
--
--  Eseguilo nel SQL Editor di Supabase DOPO 00_schema.sql, 01_rls.sql e
--  02_storage.sql. Gira come proprietario del database, quindi può inserire
--  i record di piattaforma anche senza un utente PROGRAMMATORE.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  LINEE GUIDA DEI CORSI (modelli_corso + modelli_giornata)
-- ----------------------------------------------------------------------------

insert into modelli_corso (id, asd_id, titolo, descrizione, livello) values
  ('11110000-0000-4000-8000-000000000001', null,
   'Corso Base — Principianti',
   'Percorso introduttivo al tiro con l''arco: sicurezza, postura, primi tiri e fondamentali tecnici.',
   'Base'),
  ('11110000-0000-4000-8000-000000000002', null,
   'Corso Intermedio',
   'Consolidamento della tecnica, mira, gestione della rosata e avvicinamento alla gara.',
   'Intermedio')
on conflict (id) do nothing;

-- Giornate del Corso Base
insert into modelli_giornata (id, modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti) values
  ('12110000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001', 1,
   'Sicurezza e presentazione',
   'Conoscere le regole di sicurezza al campo e l''attrezzatura di base.',
   array['Regole di sicurezza','Comandi di tiro','Attrezzatura','Parti dell''arco'], 90),
  ('12110000-0000-4000-8000-000000000002', '11110000-0000-4000-8000-000000000001', 2,
   'Postura e impugnatura',
   'Assumere una postura corretta e imparare l''incocco e la trazione.',
   array['Posizione dei piedi','Impugnatura','Incocco','Trazione'], 90),
  ('12110000-0000-4000-8000-000000000003', '11110000-0000-4000-8000-000000000001', 3,
   'Primi tiri a 5 metri',
   'Eseguire i primi tiri in sicurezza a breve distanza.',
   array['Ancoraggio','Rilascio','Follow-through','Ripetibilità'], 90),
  ('12110000-0000-4000-8000-000000000004', '11110000-0000-4000-8000-000000000001', 4,
   'Mira e allineamento',
   'Introdurre i riferimenti di mira e l''allineamento del corpo.',
   array['Linea di mira','Allineamento','Respirazione'], 90),
  ('12110000-0000-4000-8000-000000000005', '11110000-0000-4000-8000-000000000001', 5,
   'Tiro a 10 metri',
   'Aumentare la distanza mantenendo la tecnica.',
   array['Distanza 10m','Costanza','Correzione errori'], 90),
  ('12110000-0000-4000-8000-000000000006', '11110000-0000-4000-8000-000000000001', 6,
   'Prova finale e valutazione',
   'Verificare i progressi e pianificare il proseguimento.',
   array['Sequenza di tiro completa','Valutazione','Prossimi passi'], 90)
on conflict (id) do nothing;

-- Giornate del Corso Intermedio
insert into modelli_giornata (id, modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti) values
  ('12120000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000002', 1,
   'Ripasso e analisi tecnica',
   'Analizzare la tecnica individuale e correggere i difetti principali.',
   array['Video-analisi','Checklist tecnica','Obiettivi personali'], 120),
  ('12120000-0000-4000-8000-000000000002', '11110000-0000-4000-8000-000000000002', 2,
   'Gestione della rosata',
   'Migliorare il raggruppamento delle frecce.',
   array['Rosata','Regolazione mirino','Tuning di base'], 120),
  ('12120000-0000-4000-8000-000000000003', '11110000-0000-4000-8000-000000000002', 3,
   'Distanze maggiori',
   'Tirare a 18 metri con costanza.',
   array['Distanza 18m','Parabola','Concentrazione'], 120),
  ('12120000-0000-4000-8000-000000000004', '11110000-0000-4000-8000-000000000002', 4,
   'Routine di tiro e mentale',
   'Costruire una routine di tiro stabile e gestire la tensione.',
   array['Routine','Gestione emotiva','Ritmo'], 120),
  ('12120000-0000-4000-8000-000000000005', '11110000-0000-4000-8000-000000000002', 5,
   'Simulazione di gara',
   'Affrontare una simulazione di gara con punteggio.',
   array['Regolamento gara','Punteggio','Gestione dei tempi'], 120)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
--  MODULI PRONTI (modelli_modulo)
--  schema_campi: elenco dei campi che l'app mostra automaticamente.
--    tipi ammessi: testo | numero | data | checkbox | testo_lungo | email
-- ----------------------------------------------------------------------------

-- Iscrizione al corso
insert into modelli_modulo (id, asd_id, codice, titolo, descrizione, versione, richiede_firma, testo_legale, schema_campi)
values (
  '13110000-0000-4000-8000-000000000001', null, 'ISCRIZIONE_CORSO',
  'Domanda di iscrizione al corso',
  'Modulo di iscrizione a un corso della ASD.',
  1,
  true,
  'Con la presente il/la sottoscritto/a chiede di essere ammesso/a al corso indicato e dichiara di aver preso visione del regolamento della ASD e delle norme di sicurezza.',
  '[
    {"nome":"esperienza","etichetta":"Esperienza pregressa con l''arco","tipo":"testo_lungo","obbligatorio":false},
    {"nome":"mano_dominante","etichetta":"Mano dominante (destra/sinistra)","tipo":"testo","obbligatorio":true},
    {"nome":"contatto_emergenza","etichetta":"Contatto per emergenze (nome e telefono)","tipo":"testo","obbligatorio":true},
    {"nome":"come_conosciuto","etichetta":"Come ci hai conosciuto?","tipo":"testo","obbligatorio":false},
    {"nome":"note","etichetta":"Note o esigenze particolari","tipo":"testo_lungo","obbligatorio":false},
    {"nome":"accetta_regolamento","etichetta":"Dichiaro di accettare il regolamento e le norme di sicurezza","tipo":"checkbox","obbligatorio":true}
  ]'::jsonb
)
on conflict (id) do nothing;

-- Consenso privacy
insert into modelli_modulo (id, asd_id, codice, titolo, descrizione, versione, richiede_firma, testo_legale, schema_campi)
values (
  '13110000-0000-4000-8000-000000000002', null, 'PRIVACY',
  'Informativa e consenso privacy',
  'Consenso al trattamento dei dati personali ai sensi del Reg. UE 2016/679 (GDPR).',
  1,
  true,
  'La ASD tratta i dati personali forniti per la gestione dell''attivita sportiva, del tesseramento e degli adempimenti amministrativi e assicurativi. I dati relativi allo stato di salute (es. certificati medici) sono categoria particolare (art. 9 GDPR) e sono trattati esclusivamente per la verifica dell''idoneita alla pratica sportiva. I dati sono conservati per il tempo necessario agli obblighi di legge e non sono diffusi a terzi non autorizzati. In qualsiasi momento e possibile esercitare i diritti di accesso, rettifica e cancellazione contattando la ASD.',
  '[
    {"nome":"consenso_trattamento","etichetta":"Acconsento al trattamento dei miei dati personali per le finalita indicate","tipo":"checkbox","obbligatorio":true},
    {"nome":"consenso_sanitari","etichetta":"Acconsento al trattamento dei dati relativi allo stato di salute per la verifica dell''idoneita sportiva","tipo":"checkbox","obbligatorio":true},
    {"nome":"consenso_immagini","etichetta":"Acconsento all''uso di foto e video per la comunicazione della ASD (facoltativo)","tipo":"checkbox","obbligatorio":false}
  ]'::jsonb
)
on conflict (id) do nothing;

-- Autocertificazione stato di salute
insert into modelli_modulo (id, asd_id, codice, titolo, descrizione, versione, richiede_firma, testo_legale, schema_campi)
values (
  '13110000-0000-4000-8000-000000000003', null, 'AUTOCERT_SALUTE',
  'Autocertificazione stato di salute',
  'Dichiarazione in attesa del certificato medico. Non sostituisce il certificato medico sportivo.',
  1,
  true,
  'Il/la sottoscritto/a dichiara di essere in buono stato di salute e di non essere a conoscenza di controindicazioni alla pratica del tiro con l''arco, impegnandosi a consegnare il certificato medico previsto dalla normativa.',
  '[
    {"nome":"tipo_certificato","etichetta":"Tipo di certificato che consegnerai (agonistico / non agonistico)","tipo":"testo","obbligatorio":true},
    {"nome":"data_prevista","etichetta":"Data prevista di consegna del certificato","tipo":"data","obbligatorio":false},
    {"nome":"dichiara_salute","etichetta":"Dichiaro di essere in buono stato di salute per la pratica sportiva","tipo":"checkbox","obbligatorio":true}
  ]'::jsonb
)
on conflict (id) do nothing;
