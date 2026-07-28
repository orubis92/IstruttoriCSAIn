-- ============================================================================
--  14_audit_art9.sql — registro degli accessi ai dati sanitari (art. 9 GDPR)
--
--  I certificati medici sono dati relativi alla salute (categoria particolare,
--  art. 9 GDPR). Per l'accountability il titolare deve poter dimostrare CHI ha
--  fatto COSA su quei dati. Registriamo:
--    - le scritture (creazione/modifica/cancellazione) tramite un trigger;
--    - le letture dello staff sui dati di un altro atleta, tramite una RPC
--      dedicata che registra l'accesso e poi restituisce i certificati.
--
--  Il registro è di sola lettura per lo staff della ASD e per i programmatori;
--  nessun client può scriverci direttamente (si scrive solo via funzioni
--  SECURITY DEFINER). I nomi sono denormalizzati così restano leggibili anche
--  se in seguito un'anagrafica viene cancellata (diritto all'oblio).
--
--  Eseguire dopo 00,01,05. Idempotente.
-- ============================================================================

create table if not exists audit_accessi (
  id           uuid primary key default gen_random_uuid(),
  asd_id       uuid,
  attore_id    uuid references utenti(id) on delete set null,
  attore_nome  text,
  oggetto_tipo text not null,                 -- es. 'CERTIFICATO_MEDICO'
  oggetto_id   uuid,
  atleta_id    uuid,
  atleta_nome  text,
  azione       text not null,                 -- 'LETTURA'|'CREAZIONE'|'MODIFICA'|'CANCELLAZIONE'
  creato_il    timestamptz not null default now()
);
create index if not exists audit_accessi_asd_idx on audit_accessi (asd_id, creato_il desc);
create index if not exists audit_accessi_atleta_idx on audit_accessi (atleta_id, creato_il desc);

alter table audit_accessi enable row level security;

-- Sola lettura per lo staff della ASD e per i programmatori.
drop policy if exists audit_select on audit_accessi;
create policy audit_select on audit_accessi for select to authenticated
  using ( app.is_programmatore() or app.is_staff_di(asd_id) );

-- Volutamente NESSUN grant di insert/update/delete: la scrittura passa solo per
-- le funzioni SECURITY DEFINER qui sotto.
grant select on audit_accessi to authenticated;

-- ----------------------------------------------------------------------------
--  Trigger: registra le scritture sui certificati medici
-- ----------------------------------------------------------------------------
create or replace function app.log_accesso_certificato() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_att   uuid := app.mio_id();
  v_asd   uuid;
  v_atl   uuid;
  v_obj   uuid;
  v_azione text;
begin
  if tg_op = 'INSERT' then
    v_azione := 'CREAZIONE'; v_asd := new.asd_id; v_atl := new.atleta_id; v_obj := new.id;
  elsif tg_op = 'UPDATE' then
    v_azione := 'MODIFICA';  v_asd := new.asd_id; v_atl := new.atleta_id; v_obj := new.id;
  else
    v_azione := 'CANCELLAZIONE'; v_asd := old.asd_id; v_atl := old.atleta_id; v_obj := old.id;
  end if;

  insert into audit_accessi
    (asd_id, attore_id, attore_nome, oggetto_tipo, oggetto_id, atleta_id, atleta_nome, azione)
  select v_asd, v_att,
         (select nome || ' ' || cognome from utenti where id = v_att),
         'CERTIFICATO_MEDICO', v_obj, v_atl,
         (select nome || ' ' || cognome from utenti where id = v_atl),
         v_azione;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists t_certificati_audit on certificati_medici;
create trigger t_certificati_audit
  after insert or update or delete on certificati_medici
  for each row execute function app.log_accesso_certificato();

-- ----------------------------------------------------------------------------
--  RPC: lettura dei certificati di un atleta CON registrazione dell'accesso.
--  Il frontend dello staff usa questa al posto della SELECT diretta. La lettura
--  viene registrata solo quando a leggere è qualcuno DIVERSO dall'atleta stesso.
-- ----------------------------------------------------------------------------
create or replace function public.leggi_certificati_atleta(p_atleta uuid)
  returns setof certificati_medici
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_asd uuid;
  v_io  uuid := app.mio_id();
begin
  select asd_id into v_asd from utenti where id = p_atleta;
  if v_asd is null then
    raise exception 'Atleta inesistente' using errcode = '42501';
  end if;
  if not (app.is_staff_di(v_asd) or p_atleta = v_io) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;

  if v_io is not null and p_atleta <> v_io then
    insert into audit_accessi
      (asd_id, attore_id, attore_nome, oggetto_tipo, atleta_id, atleta_nome, azione)
    select v_asd, v_io,
           (select nome || ' ' || cognome from utenti where id = v_io),
           'CERTIFICATO_MEDICO', p_atleta,
           (select nome || ' ' || cognome from utenti where id = p_atleta),
           'LETTURA';
  end if;

  return query
    select * from certificati_medici
    where atleta_id = p_atleta
    order by data_scadenza desc nulls last;
end $$;

grant execute on function public.leggi_certificati_atleta(uuid) to authenticated;
