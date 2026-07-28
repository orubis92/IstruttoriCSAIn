-- ============================================================================
--  15_chat_elimina.sql — eliminazione ed uscita dalle conversazioni
--
--  La chat nasce con sole policy di select/insert (creazione via RPC). Qui
--  aggiungiamo due funzioni SECURITY DEFINER con controllo dei permessi:
--    - elimina_conversazione(): elimina l'intera conversazione (messaggi e
--      membri a cascata). Per le chat DIRETTE può farlo qualunque partecipante;
--      per i GRUPPI solo chi l'ha creato o un amministratore della ASD del gruppo.
--    - esci_da_conversazione(): l'utente esce da un gruppo (rimuove la propria
--      appartenenza); se il gruppo resta senza membri viene eliminato. Su una
--      chat diretta equivale a eliminarla.
--
--  Nessun grant di delete diretto sulle tabelle: si passa solo da queste RPC.
--  Eseguire dopo 00,01,05. Idempotente.
-- ============================================================================

create or replace function public.elimina_conversazione(p_conv uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io       uuid := app.mio_id();
  v_tipo     tipo_conversazione;
  v_creatore uuid;
  v_asd      uuid;
begin
  if v_io is null then
    raise exception 'Non autenticato' using errcode = '42501';
  end if;
  if not app.e_membro(p_conv) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;

  select tipo, creato_da, asd_id into v_tipo, v_creatore, v_asd
    from conversazioni where id = p_conv;
  if v_tipo is null then
    raise exception 'Conversazione inesistente' using errcode = '42501';
  end if;

  -- Chat diretta: qualunque dei due partecipanti può eliminarla.
  if v_tipo = 'DIRETTA' then
    delete from conversazioni where id = p_conv;   -- messaggi e membri a cascata
    return;
  end if;

  -- Gruppo: solo il creatore o un amministratore della ASD del gruppo.
  if v_io = v_creatore or app.is_admin_di(v_asd) then
    delete from conversazioni where id = p_conv;
    return;
  end if;

  raise exception 'Solo chi ha creato il gruppo o un amministratore puo eliminarlo'
    using errcode = '42501';
end $$;

grant execute on function public.elimina_conversazione(uuid) to authenticated;


create or replace function public.esci_da_conversazione(p_conv uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_io      uuid := app.mio_id();
  v_tipo    tipo_conversazione;
  v_rimasti int;
begin
  if v_io is null then
    raise exception 'Non autenticato' using errcode = '42501';
  end if;
  if not app.e_membro(p_conv) then
    raise exception 'Non autorizzato' using errcode = '42501';
  end if;

  select tipo into v_tipo from conversazioni where id = p_conv;

  -- Su una chat diretta "uscire" significa eliminarla per entrambi.
  if v_tipo = 'DIRETTA' then
    delete from conversazioni where id = p_conv;
    return;
  end if;

  delete from conversazione_membri
   where conversazione_id = p_conv and utente_id = v_io;

  select count(*) into v_rimasti
    from conversazione_membri where conversazione_id = p_conv;
  if v_rimasti = 0 then
    delete from conversazioni where id = p_conv;
  end if;
end $$;

grant execute on function public.esci_da_conversazione(uuid) to authenticated;
