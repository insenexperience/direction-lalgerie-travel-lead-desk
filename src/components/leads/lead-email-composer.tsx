"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Download, Mail, RefreshCw, Save, Send } from 'lucide-react';
import { getLeadEmailWorkspace, saveLeadEmailDraft, sendLeadEmailDraft, markLeadEmailSentExternally, type LeadEmailMessage } from '@/app/(dashboard)/leads/email-actions';
import { claimLead } from '@/app/(dashboard)/leads/actions';
import { anonymizeAgencyText, buildLeadEmailTemplate, isAgencyEmailKind, type LeadEmailKind, type LeadEmailLanguage } from '@/lib/email/lead-email-template';
import type { SupabaseLeadRow } from '@/lib/supabase-lead-row';
import { ASSISTANT_DRAFT_SAVED } from '@/lib/assistant/types';
import { useDeskToast } from '@/components/ui/desk-toast';

type Props = { lead: SupabaseLeadRow; kind: LeadEmailKind; agencyId?: string | null; proposalId?: string | null; onDirtyChange?: (dirty: boolean) => void };
type Workspace = Extract<Awaited<ReturnType<typeof getLeadEmailWorkspace>>, { ok: true }>;
const titles: Record<LeadEmailKind, string> = { welcome: 'Accusé de réception client', qualification: 'Prise de contact et qualification', agency_feasibility: 'Étude de faisabilité non chiffrée', agency_brief: 'Email de brief agence pour chiffrage' };
const statusLabels: Record<LeadEmailMessage['status'], string> = { draft: 'Brouillon', sending: 'Transmission en cours — vérifier avant tout nouvel envoi', sent: 'Envoyé depuis Travel Lead', external: 'Envoi externe déclaré', failed: 'Échec de transmission' };

export function LeadEmailComposer(props: Props) {
  return <Composer key={JSON.stringify([props.lead.id, props.kind, props.agencyId, props.proposalId])} {...props} />;
}

function Composer({ lead, kind, agencyId, proposalId, onDirtyChange }: Props) {
  const router = useRouter();
  const toast = useDeskToast();
  const [initial] = useState(() => buildLeadEmailTemplate(lead, kind));
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [subject, setSubject] = useState(initial.subject);
  const [bodyText, setBodyText] = useState(initial.bodyText);
  const [language, setLanguage] = useState<LeadEmailLanguage>(initial.language);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);
  const mutation = useRef(0);
  function setDirty(value: boolean) {
    dirtyRef.current = value;
    setDirtyState(value);
  }
  const [loading, setLoading] = useState(true);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const template = useMemo(() => buildLeadEmailTemplate(lead, kind, { language, bodyText }), [lead, kind, language, bodyText]);
  const canEdit = Boolean(workspace?.canEdit && workspace.storageReady && workspace.recipient && !workspace.recipientError);
  const agencyBlocked = kind === 'agency_brief' && !template.analysis.readyForAgencyBrief;
  const feasibilityBlocked = kind === 'agency_feasibility' && workspace?.feasibilityReady === false;
  const deliveryBlocked = Boolean(workspace?.unresolvedSending);
  const inputClass = 'w-full rounded-md border border-border bg-panel px-3 py-2.5 text-sm text-foreground focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/20 disabled:bg-panel-muted disabled:text-muted-foreground';

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    function refreshDraft(event: Event) {
      const target = (event as CustomEvent<{ leadId: string; kind: LeadEmailKind; agencyId: string | null }>).detail;
      if (!dirty && target?.leadId === lead.id && target.kind === kind && target.agencyId === (agencyId ?? null)) {
        setWorkspaceRevision((revision) => revision + 1);
      }
    }
    window.addEventListener(ASSISTANT_DRAFT_SAVED, refreshDraft);
    return () => window.removeEventListener(ASSISTANT_DRAFT_SAVED, refreshDraft);
  }, [dirty, lead.id, kind, agencyId]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = mutation.current;
    getLeadEmailWorkspace(lead.id, kind, agencyId, proposalId).then(result => {
      // A budget or another dossier change can refresh the page while this draft is being edited.
      // Keep its text and original draft revision so a competing edit is still detected on save.
      if (cancelled || dirtyRef.current || mutation.current !== startedAt) return;
      setLoading(false);
      if (!result.ok) { setError(result.error); return; }
      setWorkspace(result); setSubject(result.draft?.subject ?? result.template.subject);
      setBodyText(result.draft?.body_text ?? result.template.bodyText);
      setLanguage(result.draft?.language ?? result.template.language);
      setDraftId(result.draft?.id ?? null);
    }).catch(() => { if (!cancelled && !dirtyRef.current && mutation.current === startedAt) { setLoading(false); setError('Le brouillon n’a pas pu être chargé. Rechargez le dossier.'); } });
    return () => { cancelled = true; };
  }, [lead.id, lead.updated_at, kind, agencyId, proposalId, workspaceRevision]);

  function regenerate(nextLanguage = language) {
    if ((dirty || draftId) && !window.confirm('Remplacer le contenu actuel par un nouveau modèle basé sur les dernières informations du dossier ?')) return;
    const fresh = buildLeadEmailTemplate(lead, kind, { language: nextLanguage, agencyPortion: workspace?.agencyPortion });
    setLanguage(fresh.language); setSubject(fresh.subject); setBodyText(fresh.bodyText);
    setDirty(true); setNotice('Modèle actualisé à partir du dossier. Relisez-le avant envoi.'); setError(null);
  }

  async function save() {
    const result = await saveLeadEmailDraft({ leadId: lead.id, kind, agencyId, proposalId: workspace?.proposalId ?? proposalId, draftId, expectedUpdatedAt: workspace?.draft?.updated_at, subject, bodyText, language });
    if (!result.ok) { setError(result.error); toast.error(result.error); return null; }
    setDraftId(result.draft.id); setDirty(false);
    setWorkspace(prev => prev ? { ...prev, draft: result.draft, history: [result.draft, ...prev.history.filter(row => row.id !== result.draft.id)] } : prev);
    return result.draft.id;
  }

  function act(action: 'save' | 'send' | 'external') {
    if (action === 'external' && !window.confirm('Confirmer que vous avez déjà envoyé ce message par votre propre voie ? Cette action enregistre l’envoi dans le dossier.')) return;
    setError(null); setNotice(null);
    mutation.current += 1;
    startTransition(async () => {
      try {
        const id = await save(); if (!id) return;
        if (action === 'save') {
          const message = 'Brouillon enregistré dans le dossier.';
          setNotice(message); toast.success(message); return;
        }
        const result = action === 'send' ? await sendLeadEmailDraft(id) : await markLeadEmailSentExternally(id);
        const refreshed = await getLeadEmailWorkspace(lead.id, kind, agencyId, proposalId).catch(() => null);
        if (refreshed?.ok) {
          setWorkspace(refreshed);
          if (!refreshed.draft) setDraftId(null);
        }
        if (!result.ok) { setError(result.error); toast.error(result.error); return; }
        const message = action === 'send' ? 'Email envoyé et enregistré dans le dossier.' : 'Envoi externe enregistré dans le dossier.';
        setDraftId(null); setNotice(message); toast.success(message); router.refresh();
      } catch {
        const message = 'Le Desk n’a pas pu confirmer le résultat. Vérifiez l’historique avant de réessayer.';
        setError(message); toast.error(message);
      } finally {
        mutation.current += 1;
      }
    });
  }

  async function copy(format: 'formatted' | 'text' | 'html') {
    setError(null);
    if (isAgencyEmailKind(kind) && (anonymizeAgencyText(bodyText, lead) !== bodyText || anonymizeAgencyText(subject, lead) !== subject)) {
      setError('Le message agence contient des données personnelles du voyageur. Retirez-les avant de le copier.'); return;
    }
    try {
      if (format === 'formatted' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([template.html], { type: 'text/html' }), 'text/plain': new Blob([bodyText], { type: 'text/plain' }) })]);
      } else await navigator.clipboard.writeText(format === 'html' ? template.html : bodyText);
      setNotice(format === 'html' ? 'HTML copié.' : format === 'text' ? 'Texte copié.' : 'Email mis en forme copié. Collez-le dans votre messagerie.');
    } catch { setError('La copie a été refusée par le navigateur. Sélectionnez le contenu dans l’éditeur ou téléchargez le HTML.'); }
  }

  function download() {
    if (isAgencyEmailKind(kind) && (anonymizeAgencyText(bodyText, lead) !== bodyText || anonymizeAgencyText(subject, lead) !== subject)) {
      setError('Le message agence contient des données personnelles du voyageur. Retirez-les avant de le télécharger.'); return;
    }
    const url = URL.createObjectURL(new Blob([template.html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${lead.reference || lead.id}-${kind}.html`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-panel" aria-label={titles[kind]}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div><h3 className="flex items-center gap-2 font-display text-xl font-semibold text-steel"><Mail className="size-4" aria-hidden />{titles[kind]}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{kind === 'agency_feasibility' ? 'Demandez un avis terrain et un premier parcours à partir du projet, même si des précisions restent à obtenir. Vous pouvez modifier l’objet et le message.' : 'Le modèle reprend les informations du dossier et demande les précisions manquantes. Vous pouvez modifier l’objet et le message.'}</p></div>
        <span className="rounded-full bg-panel-muted px-3 py-1 text-xs text-muted-foreground" role="status">{loading ? 'Chargement…' : pending ? 'Traitement en cours…' : dirty ? 'Modifications à enregistrer' : draftId ? 'Brouillon enregistré' : 'Modèle à relire'}</span>
      </header>
      <div className="space-y-5 p-4 sm:p-5">
        {!isAgencyEmailKind(kind) && template.questions.length > 0 && <details className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-amber-950">{template.questions.length} information{template.questions.length > 1 ? 's' : ''} à demander au client</summary><ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-950">{template.questions.map(question => <li key={question.id}>{question.label}</li>)}</ul></details>}
        <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">Destinataire<input value={workspace?.recipient || (isAgencyEmailKind(kind) ? '' : lead.email)} readOnly className={inputClass} /></label>
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">Langue<select value={language} disabled={isAgencyEmailKind(kind) || loading || pending} onChange={e => regenerate(e.target.value as LeadEmailLanguage)} className={inputClass}><option value="fr">Français</option><option value="en">English</option></select></label>
        </div>
        <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">Objet<input value={subject} maxLength={250} disabled={loading || pending} onChange={e => { setSubject(e.target.value); setDirty(true); }} className={inputClass} /></label>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="space-y-3"><label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">Message<textarea value={bodyText} rows={18} maxLength={40000} disabled={loading || pending} onChange={e => { setBodyText(e.target.value); setDirty(true); }} className={`${inputClass} min-h-[420px] resize-y font-normal leading-relaxed`} /></label><button type="button" onClick={() => regenerate()} disabled={loading || pending} className="inline-flex items-center gap-2 text-xs font-semibold text-steel hover:underline disabled:opacity-50"><RefreshCw className="size-3.5" aria-hidden />Réactualiser le modèle depuis le dossier</button></div>
          <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">Aperçu de l’email</p><iframe title={`Aperçu — ${titles[kind]}`} sandbox="" srcDoc={template.html} className="h-[520px] w-full rounded-md border border-border bg-[#f5f6f2]" /></div>
        </div>
        {!workspace?.canEdit && !loading && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">Le référent du dossier peut enregistrer et envoyer les emails.</p>{!lead.referent_id && <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await claimLead(lead.id); if (!result.ok) { setError(result.error); return; } const refreshed = await getLeadEmailWorkspace(lead.id, kind, agencyId, proposalId); if (refreshed.ok) setWorkspace(refreshed); router.refresh(); })} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-steel">Prendre ce dossier</button>}</div>}
        {workspace?.storageError && <p className="text-sm text-destructive" role="alert">{workspace.storageError}</p>}{workspace?.recipientError && <p className="text-sm text-destructive" role="alert">{workspace.recipientError}</p>}
        {deliveryBlocked && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="alert">{workspace?.unresolvedSendingMessage}</p>}
        {kind === 'agency_feasibility' && <p className="rounded-md border border-border bg-panel-muted px-3 py-3 text-sm leading-relaxed text-muted-foreground">Première étude sans tarif ni devis : faisabilité, parcours envisagé et points à confirmer. Les informations inconnues restent signalées. Le délai de chiffrage agence commencera à l’envoi du brief chiffré.</p>}
        {feasibilityBlocked && <p role="alert" className="text-sm text-destructive">{workspace?.feasibilityMessage}</p>}
        {workspace?.agencyFollowup && <p className="text-sm leading-relaxed text-muted-foreground">Le brief a déjà été transmis à cette agence. Cet email complémentaire conserve l’état de la consultation et son délai initial.</p>}
        {agencyBlocked && <p className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-950">Le brief peut être préparé. Complétez les informations indispensables du voyage avant de l’envoyer à l’agence.</p>}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="button" disabled={!canEdit || feasibilityBlocked || pending || loading} onClick={() => act('save')} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-steel disabled:opacity-45"><Save className="size-4" aria-hidden />Enregistrer le brouillon</button>
          <button type="button" disabled={pending || loading} onClick={() => void copy('formatted')} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-steel disabled:opacity-45"><Copy className="size-4" aria-hidden />Copier l’email mis en forme</button>
          <button type="button" disabled={pending || loading} onClick={() => void copy('html')} className="rounded-md border border-border px-3 py-2 text-sm text-steel disabled:opacity-45">Copier le HTML</button><button type="button" disabled={pending || loading} onClick={() => void copy('text')} className="rounded-md border border-border px-3 py-2 text-sm text-steel disabled:opacity-45">Copier le texte</button>
          <button type="button" disabled={pending || loading} onClick={download} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-steel disabled:opacity-45"><Download className="size-4" aria-hidden />HTML</button>
        </div>
        <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!canEdit || !workspace?.resendReady || agencyBlocked || feasibilityBlocked || deliveryBlocked || pending || loading} onClick={() => act('send')} className="inline-flex items-center gap-2 rounded-md bg-steel px-4 py-2.5 text-sm font-semibold text-steel-ink disabled:opacity-45"><Send className="size-4" aria-hidden />{pending ? 'Traitement…' : kind === 'agency_brief' ? 'Envoyer le brief par e-mail' : 'Envoyer depuis Travel Lead'}</button><button type="button" disabled={!canEdit || agencyBlocked || feasibilityBlocked || deliveryBlocked || pending || loading} onClick={() => act('external')} className="rounded-md border border-border px-3 py-2.5 text-sm font-semibold text-steel disabled:opacity-45">Déclarer cet email envoyé par mes soins</button></div>
        {workspace?.deliveryMessage && <p className="text-xs text-muted-foreground">{workspace.deliveryMessage}</p>}{notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {workspace && workspace.history.filter(row => row.status !== 'draft').length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold text-steel">Historique des emails</summary><ul className="mt-3 space-y-3">{workspace.history.filter(row => row.status !== 'draft').map(row => <li key={row.id} className="rounded-md border border-border px-3 py-3 text-xs"><p className="font-semibold text-foreground">{row.subject}</p><p className="mt-1 text-muted-foreground">{statusLabels[row.status]} · {new Date(row.sent_at || row.created_at).toLocaleString('fr-FR')}</p><p className="mt-1 text-muted-foreground">{row.recipient}</p>{row.error && <p className="mt-1 text-destructive">{row.error}</p>}<details className="mt-2"><summary className="cursor-pointer text-steel">Voir le contenu enregistré</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed text-foreground">{row.body_text}</p></details></li>)}</ul></details>}
      </div>
    </section>
  );
}
