-- ============================================================================
--  19_modelli_ufficiali.sql — modelli di corso ufficiali CSAIN (linee guida)
--
--  Inserisce come modelli di PIATTAFORMA (asd_id NULL, disponibili a tutte le
--  ASD nella creazione guidata dei corsi) i tre corsi neofiti delle Linee Guida
--  Corsi Tecnici CSAIN: Base 1, Base 2 e Avanzato, con le rispettive giornate e
--  argomenti. Idempotente: se un modello con lo stesso titolo esiste già, non
--  viene reinserito.
--
--  Eseguire dopo 00. Ri-eseguibile.
-- ============================================================================

-- ---- Corso Neofiti — Base 1 (12 ore) ---------------------------------------
do $$
declare v_id uuid;
begin
  select id into v_id from modelli_corso where asd_id is null and titolo = 'Corso Neofiti — Base 1 (CSAIN)';
  if v_id is null then
    insert into modelli_corso (asd_id, titolo, descrizione, livello)
    values (null, 'Corso Neofiti — Base 1 (CSAIN)',
      'Corso di avviamento al tiro con l''arco secondo le Linee Guida CSAIN. Durata minima 12 ore, arco scuola, max 4 allievi per istruttore (I livello). Prima di iniziare verificare tesseramento CSAIN e certificato medico.',
      'Base 1')
    returning id into v_id;
    insert into modelli_giornata (modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti) values
      (v_id, 1, 'Fondamentali e sicurezza',
        'Primo approccio all''arco, lateralità e sicurezza.',
        array['Verifica lateralità e occhio dominante','Esercizi propedeutici al tiro (riscaldamento)','Sicurezza','Nomenclatura di base e terminologia dell''arciere','Core Archery: posizione di gambe, piedi e testa, bilanciamento del peso','Espansione delle spalle con corda ed elastico','Teoria: la società e il suo funzionamento'], 120),
      (v_id, 2, 'Postura e incocco',
        'Impostazione della postura e della sequenza di tiro.',
        array['Sicurezza','Esercizi propedeutici al tiro','Montaggio archi e spiegazione dei componenti','Postura','Incocco della freccia','Sollevamento dell''arco','Posizione del corpo nella trazione','Utilizzo della "T"'], 120),
      (v_id, 3, 'Piani di forza e rilascio',
        'Controllo dei piani di forza e uso dei muscoli dorsali.',
        array['Sicurezza','Esercizi propedeutici al tiro','Montaggio archi','Controllo dei piani di forza','Presa di coscienza del punto di contatto per il rilascio','Utilizzo dei muscoli dorsali'], 120),
      (v_id, 4, 'Respirazione ed equilibrio',
        'Respirazione controllata ed equilibrio nel tiro.',
        array['Sicurezza','Esercizi propedeutici al tiro','Montaggio archi','Respirazione controllata','Esercizi di equilibrio senza arco','Esercizi di equilibrio con arco','Abbinamento tiro e respirazione'], 120),
      (v_id, 5, 'Controllo del tiro',
        'Consolidamento del gesto tecnico e ripresa video.',
        array['Sicurezza','Esercizi propedeutici al tiro','Tiri in ginocchio e a tempo','Tiri ad occhi chiusi','Tiri ai paglioni con ripresa video degli allievi'], 120),
      (v_id, 6, 'Esame di fine corso',
        'Prova di tiro finale e consegna attestati.',
        array['Esercizi propedeutici al tiro','Prova di tiro: 5 frecce su bersaglio Ø 20 cm a 10 m','Cenni sul regolamento sportivo CSAIN','Consegna degli attestati di partecipazione'], 120);
  end if;
end $$;

-- ---- Corso Neofiti — Base 2 (10 ore) ---------------------------------------
do $$
declare v_id uuid;
begin
  select id into v_id from modelli_corso where asd_id is null and titolo = 'Corso Neofiti — Base 2 (CSAIN)';
  if v_id is null then
    insert into modelli_corso (asd_id, titolo, descrizione, livello)
    values (null, 'Corso Neofiti — Base 2 (CSAIN)',
      'Secondo livello del corso neofiti secondo le Linee Guida CSAIN. Durata minima 10 ore, arco scuola, istruttori di II e I livello, max 4 allievi per istruttore.',
      'Base 2')
    returning id into v_id;
    insert into modelli_giornata (modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti) values
      (v_id, 1, 'Verifica e ripasso',
        'Verifica delle competenze del Livello 1.',
        array['Esercizi propedeutici al tiro','Sicurezza','Verifica del grado di Livello 1'], 100),
      (v_id, 2, 'Tiri dinamici e 3D',
        'Introduzione al tiro dinamico e su sagome 3D.',
        array['Esercizi propedeutici al tiro','Tiri su sagome 3D','Tiri in movimento','Tiri a tempo','Tiri sulla verticale','Tiri in pendenza'], 100),
      (v_id, 3, 'Prova dei tipi di arco',
        'Confronto tra le diverse tipologie di arco.',
        array['Esercizi propedeutici al tiro','Prova dei vari tipi di arco'], 100),
      (v_id, 4, 'Teoria e frecce',
        'Storia dell''arceria, tipologie di arco e conoscenza delle frecce.',
        array['Storia dell''arceria','Le diverse tipologie di arco','Laboratorio: le frecce e la loro costruzione','Paradosso dell''arciere (con video)','Spine, tipi di frecce e di aste','Lettura delle tabelle Easton','Cenni sul regolamento gare'], 100),
      (v_id, 5, 'Scelta dell''arco',
        'Criteri per la scelta dell''arco.',
        array['Scelta dell''arco'], 100),
      (v_id, 6, 'Esame di fine corso',
        'Prova di tiro finale e consegna attestati.',
        array['Esercizi propedeutici al tiro','Prova di tiro con arco scuola: 5 frecce su bersaglio Ø 20 cm a 15 m','Consegna degli attestati di partecipazione'], 100);
  end if;
end $$;

-- ---- Corso Avanzato (10 ore) -----------------------------------------------
do $$
declare v_id uuid;
begin
  select id into v_id from modelli_corso where asd_id is null and titolo = 'Corso Avanzato (CSAIN)';
  if v_id is null then
    insert into modelli_corso (asd_id, titolo, descrizione, livello)
    values (null, 'Corso Avanzato (CSAIN)',
      'Corso avanzato secondo le Linee Guida CSAIN. Durata minima 10 ore, arco scelto dall''arciere, istruttore di II livello, max 2 allievi per istruttore. Le lezioni sono suddivise per argomenti dall''istruttore responsabile.',
      'Avanzato')
    returning id into v_id;
    insert into modelli_giornata (modello_corso_id, ordine, titolo, obiettivi, argomenti, durata_minuti) values
      (v_id, 1, 'Il proprio arco e messa a punto',
        'Conoscenza e messa a punto della propria attrezzatura.',
        array['Funzionamento del proprio arco','Messa a punto base','Attrezzatura e accessori'], 120),
      (v_id, 2, 'Lettura del tiro',
        'Interpretazione degli impatti e analisi della tecnica.',
        array['Interpretazione degli impatti','Riprese e valutazione della tecnica applicata'], 120),
      (v_id, 3, 'Tecnica su campo 3D',
        'Applicazione della tecnica su campo attrezzato.',
        array['Tecnica di tiro','Valutazione delle distanze','Errori di luce e prospettiva','Applicazione della tecnica su campo attrezzato 3D'], 120),
      (v_id, 4, 'Taratura fine',
        'Affinamento della messa a punto.',
        array['Taratura fine'], 120),
      (v_id, 5, 'Esame di fine corso',
        'Prova di tiro finale e consegna attestati.',
        array['Esercizi propedeutici al tiro','Prova di tiro: 5 frecce su bersaglio Ø 20 cm a 20 m','Consegna degli attestati di partecipazione'], 120);
  end if;
end $$;
