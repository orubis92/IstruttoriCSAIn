-- ============================================================================
--  07_impostazioni.sql — logo della ASD
--
--  Aggiunge il logo dell'ASD, salvato come immagine (data URL PNG/JPEG) nel
--  record della ASD. Viene usato nella barra dell'app e sui diplomi in stampa.
--
--  Le policy esistenti su "asd" bastano: solo l'amministratore della ASD (o un
--  programmatore) può aggiornarne i dati, quindi anche il logo. Eseguire dopo
--  00,01,02. Idempotente.
-- ============================================================================

alter table asd add column if not exists logo text;
