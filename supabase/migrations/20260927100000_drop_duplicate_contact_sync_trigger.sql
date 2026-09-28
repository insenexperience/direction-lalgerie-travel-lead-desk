-- Le déclencheur leads_sync_contact (migration v5.1, 03/05/2026) aurait dû disparaître quand
-- trg_lead_close_sync_contact l'a remplacé (20260521040000 : « désactiver l'ancien trigger de sync
-- pour éviter les doublons » — c'est on_lead_status_won_lost qui a été retiré, pas lui).
--
-- Resté actif, il échoue : `on conflict (source_lead_id)` ne correspond pas à l'index partiel
-- contacts_source_lead_unique (`where source_lead_id is not null`) → erreur 42P10. Conséquence
-- constatée le 27/09/2026 : aucun lead ne peut passer en gagné ou perdu.
--
-- trg_lead_close_sync_contact continue de créer ou mettre à jour la fiche contact.
drop trigger if exists leads_sync_contact on public.leads;
