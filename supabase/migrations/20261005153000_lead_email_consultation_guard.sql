-- Simultaneous clicks reuse one consultation prepared by the reviewed email workflow.
create unique index lead_circuit_proposals_one_mail_consultation_idx
  on public.lead_circuit_proposals(lead_id, agency_id)
  where agency_proposal_payload->>'mail_workflow' = 'reviewed';
