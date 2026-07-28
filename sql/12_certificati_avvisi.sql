-- ============================================================================
--  12_certificati_avvisi.sql — validità certificati medici, avvisi e promemoria
--
--  Aggiunge, SENZA modificare i dati già presenti:
--    - app.atleta_ha_certificato_valido(): true se l'atleta ha un certificato
--      con scadenza futura. Utile per evidenziare/limitare le iscrizioni.
--    - v_certificati_atleti: per ogni atleta (della propria ASD, per lo staff;
--      solo sé stesso, per l'atleta) lo stato del certificato più recente
--      (ASSENTE / SCADUTO / IN_SCADENZA / VALIDO) e i giorni alla scadenza.
--    - accoda_avvisi_certificati(): mette in coda una notifica push/email
--      all'atleta quando il certificato è scaduto o scade entro 30 giorni,
--      rispettando le sue preferenze e senza generare doppioni.
--
--  Eseguire dopo 00,01,05,09,11. Idempotente.
-- ============================================================================

-- L'atleta ha un certificato medico ancora valido oggi?
create or replace function app.atleta_ha_certificato_valido(p_atleta uuid)
  returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.certificati_medici c
    where c.atleta_id = p_atleta
      and c.data_scadenza is not null
      and c.data_scadenza >= current_date
  );
$$;
grant execute on function app.atleta_ha_certificato_valido(uuid) to authenticated;

-- Stato del certificato più recente, per atleta.
-- security_invoker = false (gira come proprietario) + barrier + WHERE che vincola
-- l'accesso: lo staff vede gli atleti della propria ASD, l'atleta vede sé stesso.
create or replace view v_certificati_atleti
  with (security_invoker = false, security_barrier = true) as
  select
    u.id      as atleta_id,
    u.asd_id  as asd_id,
    u.nome    as nome,
    u.cognome as cognome,
    c.tipo    as tipo,
    c.data_scadenza as data_scadenza,
    case
      when c.data_scadenza is null            then 'ASSENTE'
      when c.data_scadenza <  current_date    then 'SCADUTO'
      when c.data_scadenza <= current_date + 30 then 'IN_SCADENZA'
      else 'VALIDO'
    end as stato,
    case when c.data_scadenza is null then null
         else (c.data_scadenza - current_date) end as giorni_alla_scadenza
  from public.utenti u
  left join lateral (
    select cm.tipo, cm.data_scadenza
    from public.certificati_medici cm
    where cm.atleta_id = u.id
    order by cm.data_scadenza desc nulls last, cm.creato_il desc
    limit 1
  ) c on true
  where u.ruolo = 'ATLETA' and u.attivo
    and (app.is_staff_di(u.asd_id) or u.id = app.mio_id());

grant select on v_certificati_atleti to authenticated;

-- Mette in coda gli avvisi per i certificati scaduti o in scadenza (<= 30 giorni).
-- Da richiamare periodicamente dalla funzione Edge (come accoda_promemoria).
-- La chiave_dedup include la data di scadenza: un nuovo certificato (nuova
-- scadenza) tornerà a generare l'avviso, ma lo stesso non viene ripetuto.
create or replace function public.accoda_avvisi_certificati() returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prima int;
begin
  select count(*) into v_prima from notifiche_coda where stato = 'IN_ATTESA';

  with ultimi as (
    select distinct on (cm.atleta_id)
           cm.atleta_id, cm.asd_id, cm.data_scadenza
    from certificati_medici cm
    where cm.data_scadenza is not null
    order by cm.atleta_id, cm.data_scadenza desc
  )
  insert into notifiche_coda (utente_id, tipo, canale, titolo, corpo, url, chiave_dedup)
  select u.id, 'CERTIFICATO', ch.canale,
         case when ul.data_scadenza < current_date
              then 'Certificato medico scaduto'
              else 'Certificato medico in scadenza' end,
         case when ul.data_scadenza < current_date
              then 'Il tuo certificato medico è scaduto il ' || to_char(ul.data_scadenza,'DD/MM/YYYY') || '. Contatta la tua ASD per rinnovarlo.'
              else 'Il tuo certificato medico scade il ' || to_char(ul.data_scadenza,'DD/MM/YYYY') || '. Ricordati di rinnovarlo.' end,
         '/profilo',
         'cert:' || u.id || ':' || ul.data_scadenza || ':'
           || (case when ul.data_scadenza < current_date then 'sca' else 'scad' end)
           || ':' || ch.canale
  from ultimi ul
  join utenti u on u.id = ul.atleta_id and u.attivo and u.ruolo = 'ATLETA'
  join preferenze_notifiche p on p.utente_id = u.id
  cross join lateral (values
      ('PUSH'::canale_notifica,  coalesce(p.via_push, false)),
      ('EMAIL'::canale_notifica, coalesce(p.via_email, false))
  ) as ch(canale, attivo)
  where ul.data_scadenza <= current_date + 30
    and ch.attivo
    and (ch.canale <> 'EMAIL' or u.email is not null)
  on conflict (utente_id, chiave_dedup) where chiave_dedup is not null do nothing;

  return (select count(*) from notifiche_coda where stato = 'IN_ATTESA') - v_prima;
end $$;

grant execute on function public.accoda_avvisi_certificati() to authenticated;
