-- ============================================================================
--  01_rls.sql — Row Level Security: isolamento multi-ASD e permessi per ruolo
--
--  Regola d'oro: NESSUNA query del client sceglie la ASD. È il database che
--  filtra, sempre, in base all'identità di chi chiama. Un bug del frontend non
--  può quindi far trapelare i dati di un'altra ASD.
--
--  NOTA: non attivare "force row level security" sulle tabelle lette dalle
--  funzioni in schema app (in particolare utenti): quelle funzioni sono
--  SECURITY DEFINER e devono poter bypassare RLS, altrimenti si genera
--  ricorsione infinita nelle policy.
-- ============================================================================

alter table asd              enable row level security;
alter table utenti           enable row level security;
alter table inviti           enable row level security;
alter table documenti        enable row level security;
alter table documento_atleti enable row level security;
alter table modelli_corso    enable row level security;
alter table modelli_giornata enable row level security;
alter table corsi            enable row level security;
alter table giornate         enable row level security;
alter table iscrizioni       enable row level security;
alter table presenze         enable row level security;
alter table modelli_modulo   enable row level security;
alter table moduli_compilati enable row level security;


-- ----------------------------------------------------------------------------
--  ASD
-- ----------------------------------------------------------------------------
create policy asd_select on asd for select to authenticated
  using ( app.is_programmatore() or app.is_membro_di(id) );

create policy asd_insert on asd for insert to authenticated
  with check ( app.is_programmatore() );   -- il percorso normale è registra_asd()

create policy asd_update on asd for update to authenticated
  using      ( app.is_programmatore() or app.is_admin_di(id) )
  with check ( app.is_programmatore() or app.is_admin_di(id) );

create policy asd_delete on asd for delete to authenticated
  using ( app.is_programmatore() );


-- ----------------------------------------------------------------------------
--  UTENTI
--  Scelta di privacy: un atleta NON vede l'anagrafica degli altri atleti
--  (codice fiscale, data di nascita...). Vede solo se stesso.
--  Per conoscere i propri istruttori usa la vista v_staff_asd (sotto).
-- ----------------------------------------------------------------------------
create policy utenti_select on utenti for select to authenticated
  using (
       app.is_programmatore()
    or id = app.mio_id()
    or app.is_staff_di(asd_id)
  );

-- Gli amministratori creano istruttori e atleti; gli istruttori solo atleti.
create policy utenti_insert on utenti for insert to authenticated
  with check (
       app.is_programmatore()
    or (app.is_admin_di(asd_id)      and ruolo <> 'PROGRAMMATORE')
    or (app.is_istruttore_di(asd_id) and ruolo =  'ATLETA')
  );

-- L'utente può aggiornare i propri recapiti. Le colonne critiche
-- (ruolo, asd_id, attivo, auth_id) sono protette dal trigger
-- app.protegge_identita(): senza quel trigger un amministratore potrebbe
-- promuoversi da solo a PROGRAMMATORE riscrivendo la propria riga.
create policy utenti_update on utenti for update to authenticated
  using      ( app.is_programmatore() or app.is_admin_di(asd_id) or id = app.mio_id() )
  with check ( app.is_programmatore() or app.is_admin_di(asd_id) or id = app.mio_id() );

create policy utenti_delete on utenti for delete to authenticated
  using ( app.is_programmatore() or app.is_admin_di(asd_id) );

-- Vista di sola lettura con i soli dati non sensibili dello staff della
-- propria ASD: permette all'atleta di sapere chi sono i suoi istruttori
-- senza esporne i dati personali.
create view v_staff_asd with (security_invoker = false, security_barrier = true) as
  select u.id, u.asd_id, u.nome, u.cognome, u.ruolo
    from utenti u
   where u.attivo
     and u.ruolo in ('AMMINISTRATORE_ASD','ISTRUTTORE')
     and u.asd_id = app.mia_asd();

grant select on v_staff_asd to authenticated;


-- ----------------------------------------------------------------------------
--  INVITI  (attivazione degli account creati dallo staff)
-- ----------------------------------------------------------------------------
-- Attenzione: chi legge il codice di un invito può rivendicare quel profilo.
-- Un istruttore deve quindi poter gestire SOLO gli inviti verso atleti: se
-- vedesse il codice destinato a un profilo di amministratore non ancora
-- attivato, potrebbe usarlo per diventare amministratore.
create policy inviti_amministratore on inviti for all to authenticated
  using      ( exists (select 1 from utenti u where u.id = inviti.utente_id
                        and app.is_admin_di(u.asd_id)) )
  with check ( exists (select 1 from utenti u where u.id = inviti.utente_id
                        and app.is_admin_di(u.asd_id)) );

create policy inviti_istruttore on inviti for all to authenticated
  using      ( exists (select 1 from utenti u where u.id = inviti.utente_id
                        and u.ruolo = 'ATLETA' and app.is_istruttore_di(u.asd_id)) )
  with check ( exists (select 1 from utenti u where u.id = inviti.utente_id
                        and u.ruolo = 'ATLETA' and app.is_istruttore_di(u.asd_id)) );


-- ----------------------------------------------------------------------------
--  DOCUMENTI — il cuore del modello a tre livelli
-- ----------------------------------------------------------------------------
create policy documenti_select on documenti for select to authenticated
  using (
    -- 1) documentazione generale di piattaforma: visibile a tutti gli utenti
    --    con un profilo ATTIVO (un account disattivato non deve più leggere nulla)
    (scope = 'GENERALE' and app.mio_id() is not null)
    or (
      scope = 'ASD' and (
        -- 2) staff (amministratori e istruttori): TUTTI i documenti della propria ASD
        app.is_staff_di(asd_id)
        -- 3) documenti pubblici della ASD: tutti i membri
        or (visibilita = 'PUBBLICO' and app.is_membro_di(asd_id))
        -- 4) documenti privati: solo gli atleti indicati, il diretto interessato
        --    e chi lo ha caricato
        or (visibilita = 'PRIVATO' and (
              atleta_riferimento = app.mio_id()
           or caricato_da        = app.mio_id()
           or app.e_destinatario(id)
        ))
      )
    )
  );

create policy documenti_insert on documenti for insert to authenticated
  with check (
    -- solo i PROGRAMMATORI pubblicano documentazione generale
    (scope = 'GENERALE' and app.is_programmatore())
    -- lo staff carica qualsiasi documento della propria ASD
    or (scope = 'ASD' and app.is_staff_di(asd_id))
    -- l'atleta carica la PROPRIA documentazione (certificati, privacy firmata...)
    -- e solo dentro la propria cartella personale: senza questo vincolo potrebbe
    -- registrare il percorso di un file riservato altrui e ottenerne il download.
    or (scope = 'ASD' and visibilita = 'PRIVATO'
        and app.is_membro_di(asd_id)
        and atleta_riferimento = app.mio_id()
        and caricato_da        = app.mio_id()
        and file_path like 'asd/' || asd_id::text || '/atleti/' || app.mio_id()::text || '/%')
  );

create policy documenti_update on documenti for update to authenticated
  using      ( (scope = 'GENERALE' and app.is_programmatore()) or (scope = 'ASD' and app.is_staff_di(asd_id)) )
  with check ( (scope = 'GENERALE' and app.is_programmatore()) or (scope = 'ASD' and app.is_staff_di(asd_id)) );

create policy documenti_delete on documenti for delete to authenticated
  using (
       (scope = 'GENERALE' and app.is_programmatore())
    or (scope = 'ASD' and app.is_staff_di(asd_id))
    -- l'atleta può ritirare ciò che ha caricato, ma solo nella propria ASD
    or (scope = 'ASD' and asd_id = app.mia_asd() and caricato_da = app.mio_id())
  );

-- Elenco destinatari dei documenti privati: gestito dallo staff.
-- L'atleta vede solo la propria riga (non l'elenco completo degli altri).
create policy doc_atleti_select on documento_atleti for select to authenticated
  using ( app.is_staff_di(asd_id) or atleta_id = app.mio_id() );

create policy doc_atleti_write on documento_atleti for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );


-- ----------------------------------------------------------------------------
--  MODELLI DI CORSO (linee guida) — asd_id NULL = validi per tutte le ASD
-- ----------------------------------------------------------------------------
create policy modelli_corso_select on modelli_corso for select to authenticated
  using ( (asd_id is null and app.mio_id() is not null) or app.is_membro_di(asd_id) );

create policy modelli_corso_write on modelli_corso for all to authenticated
  using      ( (asd_id is null and app.is_programmatore()) or app.is_staff_di(asd_id) )
  with check ( (asd_id is null and app.is_programmatore()) or app.is_staff_di(asd_id) );

create policy modelli_giornata_select on modelli_giornata for select to authenticated
  using ( exists (select 1 from modelli_corso m where m.id = modello_corso_id) );

create policy modelli_giornata_write on modelli_giornata for all to authenticated
  using ( exists (select 1 from modelli_corso m where m.id = modello_corso_id
                   and ((m.asd_id is null and app.is_programmatore()) or app.is_staff_di(m.asd_id))) )
  with check ( exists (select 1 from modelli_corso m where m.id = modello_corso_id
                   and ((m.asd_id is null and app.is_programmatore()) or app.is_staff_di(m.asd_id))) );


-- ----------------------------------------------------------------------------
--  CORSI E GIORNATE
--  L'atleta vede i corsi a cui è iscritto e quelli aperti alle iscrizioni.
-- ----------------------------------------------------------------------------
create policy corsi_select on corsi for select to authenticated
  using (
       app.is_staff_di(asd_id)
    or (app.is_membro_di(asd_id) and (app.e_iscritto_a(id) or stato = 'APERTO'))
  );

create policy corsi_write on corsi for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );

-- Le giornate seguono la visibilità del corso a cui appartengono.
create policy giornate_select on giornate for select to authenticated
  using ( exists (select 1 from corsi c where c.id = corso_id) );

create policy giornate_write on giornate for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );


-- ----------------------------------------------------------------------------
--  ISCRIZIONI E PRESENZE — l'atleta vede solo le proprie
-- ----------------------------------------------------------------------------
create policy iscrizioni_select on iscrizioni for select to authenticated
  using ( app.is_staff_di(asd_id) or atleta_id = app.mio_id() );

create policy iscrizioni_insert on iscrizioni for insert to authenticated
  with check (
       app.is_staff_di(asd_id)
    -- auto-candidatura: solo a corsi effettivamente aperti alle iscrizioni
    or (atleta_id = app.mio_id() and stato = 'RICHIESTA'
        and exists (select 1 from corsi c where c.id = corso_id and c.stato = 'APERTO'))
  );

create policy iscrizioni_update on iscrizioni for update to authenticated
  using ( app.is_staff_di(asd_id) ) with check ( app.is_staff_di(asd_id) );

create policy iscrizioni_delete on iscrizioni for delete to authenticated
  using ( app.is_staff_di(asd_id) );

create policy presenze_select on presenze for select to authenticated
  using ( app.is_staff_di(asd_id) or atleta_id = app.mio_id() );

create policy presenze_write on presenze for all to authenticated
  using      ( app.is_staff_di(asd_id) )
  with check ( app.is_staff_di(asd_id) );


-- ----------------------------------------------------------------------------
--  MODULISTICA
-- ----------------------------------------------------------------------------
create policy modelli_modulo_select on modelli_modulo for select to authenticated
  using ( (asd_id is null and app.mio_id() is not null) or app.is_membro_di(asd_id) );

create policy modelli_modulo_write on modelli_modulo for all to authenticated
  using      ( (asd_id is null and app.is_programmatore()) or app.is_admin_di(asd_id) )
  with check ( (asd_id is null and app.is_programmatore()) or app.is_admin_di(asd_id) );

create policy moduli_compilati_select on moduli_compilati for select to authenticated
  using ( app.is_staff_di(asd_id) or atleta_id = app.mio_id() );

-- L'atleta compila per sé, partendo sempre da BOZZA e senza potersi
-- auto-attestare la firma; il modello usato deve essere di piattaforma o della
-- propria ASD.
create policy moduli_compilati_insert on moduli_compilati for insert to authenticated
  with check (
    (
      app.is_staff_di(asd_id)
      or (atleta_id = app.mio_id() and app.is_membro_di(asd_id)
          and stato = 'BOZZA' and firmato_il is null)
    )
    and exists (select 1 from modelli_modulo m
                 where m.id = modello_id
                   and (m.asd_id is null or m.asd_id = moduli_compilati.asd_id))
  );

create policy moduli_compilati_update on moduli_compilati for update to authenticated
  using      ( app.is_staff_di(asd_id) or (atleta_id = app.mio_id() and stato = 'BOZZA') )
  with check (
    ( app.is_staff_di(asd_id)
      or (atleta_id = app.mio_id()
          and stato in ('BOZZA','INVIATO') and firmato_il is null) )
    -- stesso controllo dell'INSERT: il modello non può essere sostituito a
    -- posteriori con quello di un'altra ASD.
    and exists (select 1 from modelli_modulo m
                 where m.id = modello_id
                   and (m.asd_id is null or m.asd_id = moduli_compilati.asd_id))
  );

create policy moduli_compilati_delete on moduli_compilati for delete to authenticated
  using ( app.is_staff_di(asd_id) );
