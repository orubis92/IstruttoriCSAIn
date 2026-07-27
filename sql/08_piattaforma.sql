-- ============================================================================
--  08_piattaforma.sql — impostazioni di piattaforma (logo CSAIN)
--
--  Tabella a riga unica con le impostazioni valide per TUTTA la piattaforma.
--  Per ora contiene il logo CSAIN, gestito solo dai PROGRAMMATORI e mostrato in
--  interfaccia (a sinistra del logo della ASD) e sui diplomi (in alto a destra).
--  Tutti gli utenti autenticati possono leggerlo.
--
--  Eseguire dopo 00,01 (per la funzione app.is_programmatore). Idempotente.
-- ============================================================================

create table if not exists impostazioni_piattaforma (
  id            int primary key default 1,
  logo_csain    text,
  aggiornato_il timestamptz not null default now(),
  constraint una_sola_riga check (id = 1)
);

-- Riga singleton
insert into impostazioni_piattaforma (id) values (1) on conflict (id) do nothing;

drop trigger if exists t_imp_piattaforma_touch on impostazioni_piattaforma;
create trigger t_imp_piattaforma_touch before update on impostazioni_piattaforma
  for each row execute function app.tocca_timestamp();

alter table impostazioni_piattaforma enable row level security;

-- Lettura: chiunque sia autenticato (serve per mostrare il logo ovunque).
drop policy if exists imp_piattaforma_select on impostazioni_piattaforma;
create policy imp_piattaforma_select on impostazioni_piattaforma for select to authenticated
  using ( true );

-- Modifica: solo i programmatori.
drop policy if exists imp_piattaforma_update on impostazioni_piattaforma;
create policy imp_piattaforma_update on impostazioni_piattaforma for update to authenticated
  using      ( app.is_programmatore() )
  with check ( app.is_programmatore() );

grant select, update on impostazioni_piattaforma to authenticated;
