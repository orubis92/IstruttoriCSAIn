-- ============================================================================
--  02_storage.sql — bucket dei file e policy di accesso
--
--  Convenzione dei percorsi (fondamentale: le policy si basano su questa e i
--  vincoli CHECK sulle tabelle la rendono obbligatoria):
--    generale/<uuid>.<ext>                        → documentazione di piattaforma
--    asd/<asd_id>/staff/<uuid>.<ext>              → caricato da amministratori/istruttori
--    asd/<asd_id>/atleti/<utente_id>/<uuid>.<ext> → caricato dall'atleta
--    asd/<asd_id>/moduli/<modulo_id>.pdf          → modulistica compilata
--
--  Il bucket è PRIVATO: nessun file è raggiungibile da URL pubblico.
--  L'accesso in lettura ricalca la visibilità della riga in "documenti", quindi
--  le regole dei documenti e quelle dei file non possono divergere. Il vincolo
--  doc_path_coerente impedisce di registrare il percorso di un'altra ASD.
-- ============================================================================

insert into storage.buckets (id, name, public)
     values ('documenti', 'documenti', false)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
--  LETTURA: si può scaricare un file solo se si può vedere la riga che lo
--  referenzia. Il controllo sul prefisso di tenant è ridondante rispetto ai
--  vincoli CHECK, ma è una seconda barriera voluta.
-- ----------------------------------------------------------------------------
create policy "documenti: lettura file" on storage.objects for select to authenticated
using (
  bucket_id = 'documenti'
  and (
    exists (
      select 1 from public.documenti d
       where d.file_path = storage.objects.name
         and (d.scope = 'GENERALE'
              or storage.objects.name like 'asd/' || d.asd_id::text || '/%')
    )
    or exists (
      select 1 from public.moduli_compilati m
       where (m.pdf_path = storage.objects.name or m.firma_path = storage.objects.name)
         and storage.objects.name like 'asd/' || m.asd_id::text || '/%'
    )
  )
);


-- ----------------------------------------------------------------------------
--  SCRITTURA
-- ----------------------------------------------------------------------------

-- Solo i PROGRAMMATORI caricano la documentazione generale.
create policy "generale: caricamento" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documenti'
  and split_part(name, '/', 1) = 'generale'
  and app.is_programmatore()
);

-- Lo staff carica nella cartella della propria ASD.
create policy "asd: caricamento staff" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documenti'
  and split_part(name, '/', 1) = 'asd'
  and app.is_staff_di(app.uuid_o_null(split_part(name, '/', 2)))
);

-- L'atleta carica SOLO nella propria sottocartella personale.
create policy "asd: caricamento atleta" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documenti'
  and split_part(name, '/', 1) = 'asd'
  and app.uuid_o_null(split_part(name, '/', 2)) = app.mia_asd()
  and split_part(name, '/', 3) = 'atleti'
  and app.uuid_o_null(split_part(name, '/', 4)) = app.mio_id()
);

-- L'atleta carica il PDF/la firma dei propri moduli: il percorso non è libero,
-- deve corrispondere esattamente a quello derivato dalla riga del modulo.
create policy "asd: caricamento modulo atleta" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documenti'
  and exists (
    select 1 from public.moduli_compilati m
     where m.atleta_id = app.mio_id()
       and storage.objects.name in (m.pdf_path, m.firma_path)
  )
);

-- Cancellazione: staff sulla propria ASD, programmatori sul generale,
-- atleta sui propri file.
create policy "documenti: cancellazione" on storage.objects for delete to authenticated
using (
  bucket_id = 'documenti'
  and (
       (split_part(name, '/', 1) = 'generale' and app.is_programmatore())
    or (split_part(name, '/', 1) = 'asd'
        and app.is_staff_di(app.uuid_o_null(split_part(name, '/', 2))))
    or (split_part(name, '/', 1) = 'asd'
        and split_part(name, '/', 3) = 'atleti'
        and app.uuid_o_null(split_part(name, '/', 4)) = app.mio_id())
  )
);

create policy "documenti: aggiornamento" on storage.objects for update to authenticated
using (
  bucket_id = 'documenti'
  and (
       (split_part(name, '/', 1) = 'generale' and app.is_programmatore())
    or (split_part(name, '/', 1) = 'asd'
        and app.is_staff_di(app.uuid_o_null(split_part(name, '/', 2))))
  )
);
