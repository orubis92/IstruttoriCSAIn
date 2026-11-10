-- ============================================================================
--  21_notifiche_diagnostica.sql — coda notifiche: scadenza delle righe vecchie
--                                 e diagnostica dell'invio dall'app
--
--  1. Le push/email rimaste in coda da più di 12 ore vengono scartate (stato
--     ERRORE, errore 'scaduta'): quando l'invio riparte dopo un fermo, gli
--     utenti NON ricevono una raffica di promemoria e messaggi vecchi. Restano
--     comunque visibili nel centro notifiche dell'app.
--     Lo scarto avviene a ogni giro della funzione Edge (accoda_promemoria) e
--     può essere lanciato a mano dal programmatore (scarta_notifiche_scadute).
--  2. stato_invio_notifiche() riporta anche l'ultima esecuzione del job pg_cron
--     e l'ultima risposta HTTP della funzione Edge (tabella net._http_response,
--     conservata da Supabase per circa 6 ore): così la causa di un blocco si
--     vede dall'app, senza aprire la dashboard.
--
--  Eseguire dopo 20. Idempotente.
-- ============================================================================

create or replace function app.scarta_scadute() returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n int;
begin
  update notifiche_coda
     set stato = 'ERRORE', errore = 'scaduta: non inviata entro 12 ore'
   where stato = 'IN_ATTESA'
     and creato_il < now() - interval '12 hours';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.scarta_scadute() from public;

-- Il programmatore può ripulire la coda dall'app.
create or replace function public.scarta_notifiche_scadute() returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_programmatore() then
    raise exception 'Riservato ai programmatori' using errcode = '42501';
  end if;
  return app.scarta_scadute();
end $$;
grant execute on function public.scarta_notifiche_scadute() to authenticated;

-- Ogni giro della funzione Edge scarta prima le righe scadute, poi genera i
-- promemoria dovuti.
create or replace function public.accoda_promemoria() returns int
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.scarta_scadute();
  return app.genera_promemoria(now());
end $$;
grant execute on function public.accoda_promemoria() to authenticated;

create or replace function public.stato_invio_notifiche() returns json
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_base   json;
  v_errori json;
  v_cron   boolean;
  v_run    json;
  v_http   json;
begin
  if not app.is_programmatore() then
    raise exception 'Riservato ai programmatori' using errcode = '42501';
  end if;

  select json_build_object(
           'in_attesa',             count(*) filter (where stato = 'IN_ATTESA'),
           'piu_vecchia_in_attesa', min(creato_il) filter (where stato = 'IN_ATTESA'),
           'inviate_24h',           count(*) filter (where stato = 'INVIATA' and inviata_il > now() - interval '24 hours'),
           'errori_24h',            count(*) filter (where stato = 'ERRORE' and creato_il > now() - interval '24 hours'
                                                       and errore not like 'scaduta%'),
           'scadute_scartabili',    count(*) filter (where stato = 'IN_ATTESA' and creato_il < now() - interval '12 hours'),
           'ultimo_invio',          max(inviata_il),
           'dispositivi',           (select count(*) from push_subscriptions)
         )
    into v_base
    from notifiche_coda;

  select coalesce(json_agg(e), '[]'::json) into v_errori
  from (
    select creato_il, canale, tipo, errore, stato
    from notifiche_coda
    where errore is not null and errore <> 'nessun dispositivo' and errore not like 'scaduta%'
    order by creato_il desc
    limit 5
  ) e;

  -- pg_cron / pg_net potrebbero non essere installati o accessibili: NULL.
  begin
    execute 'select exists (select 1 from cron.job where jobname = ''invia-notifiche'')' into v_cron;
  exception when others then
    v_cron := null;
  end;

  begin
    execute $q$
      select row_to_json(r) from (
        select d.status, d.start_time, left(d.return_message, 300) as messaggio
        from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid
        where j.jobname = 'invia-notifiche'
        order by d.start_time desc
        limit 1
      ) r
    $q$ into v_run;
  exception when others then
    v_run := null;
  end;

  begin
    execute $q$
      select row_to_json(r) from (
        select h.status_code, h.created, left(coalesce(h.error_msg, h.content::text), 300) as messaggio,
               h.timed_out
        from net._http_response h
        order by h.created desc
        limit 1
      ) r
    $q$ into v_http;
  exception when others then
    v_http := null;
  end;

  return json_build_object(
    'coda', v_base,
    'ultimi_errori', v_errori,
    'cron_programmato', v_cron,
    'ultima_esecuzione_cron', v_run,
    'ultima_risposta_http', v_http
  );
end $$;
grant execute on function public.stato_invio_notifiche() to authenticated;
