"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteLead as deleteLeadFromServer,
  toggleLeadStarred,
  updateLeadStatus,
} from "@/app/(dashboard)/leads/actions";
import { timelineEntry } from "@/lib/demo-lead-factory";
import { fetchLeadsFromBrowser } from "@/lib/leads-browser-fetch";
import { isUuid } from "@/lib/is-uuid";
import type {
  AgencyConsultationStatus,
  LeadStatus,
  MockLead,
} from "@/lib/mock-leads";
import {
  agencyConsultationLabelFr,
  leadStatusLabelFr,
} from "@/lib/mock-leads";

function normalizeLead(l: MockLead): MockLead {
  return {
    ...l,
    agencyLinks: l.agencyLinks ?? [],
    retainedAgencyId: l.retainedAgencyId ?? null,
    referentId: l.referentId ?? null,
  };
}

function normalizeLeads(list: MockLead[]): MockLead[] {
  return list.map(normalizeLead);
}

function leadsFingerprint(list: MockLead[]): string {
  if (!list.length) return "__empty__";
  return list
    .map((l) => `${l.id}:${l.status}:${l.referentId ?? ""}:${l.starred}`)
    .join("|");
}

type LeadsDemoContextValue = {
  leads: MockLead[];
  filteredLeads: MockLead[];
  /** Utilisateur connecté (UUID profil auth), pour filtres « Mes dossiers ». */
  currentUserId: string | null;
  search: string;
  setSearch: (value: string) => void;
  moveLeadToStatus: (leadId: string, status: LeadStatus) => void;
  setLeadStatus: (leadId: string, status: LeadStatus) => void;
  toggleStar: (leadId: string) => void;
  refreshLeads: () => void;
  addLeadAgencyConsultation: (
    leadId: string,
    input: { agencyId: string; agencyName: string },
  ) => void;
  setLeadAgencyLinkStatus: (
    leadId: string,
    linkId: string,
    status: AgencyConsultationStatus,
  ) => void;
  setLeadAgencyLinkQuote: (
    leadId: string,
    linkId: string,
    quoteSummary: string,
  ) => void;
  setRetainedAgencyForLead: (
    leadId: string,
    retainedAgencyId: string | null,
    retainedDisplayName: string | null,
  ) => void;
  /** Supprime un lead (Supabase si UUID, sinon démo locale). */
  deleteLead: (leadId: string) => Promise<void>;
};

const LeadsDemoContext = createContext<LeadsDemoContextValue | null>(null);

type LeadsDemoProviderProps = {
  children: ReactNode;
  initialLeads: MockLead[];
  currentUserId?: string | null;
};

export function LeadsDemoProvider({
  children,
  initialLeads,
  currentUserId = null,
}: LeadsDemoProviderProps) {
  const router = useRouter();
  const [leads, setLeads] = useState(() => normalizeLeads(initialLeads));
  const [search, setSearch] = useState("");

  const initialFingerprint = useMemo(
    () => leadsFingerprint(initialLeads),
    [initialLeads],
  );

  useEffect(() => {
    setLeads(normalizeLeads(initialLeads));
  }, [initialFingerprint]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { leads: remote, error } = await fetchLeadsFromBrowser();
      if (cancelled) return;
      if (error) {
        return;
      }
      setLeads(normalizeLeads(remote));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const agenciesHay = (l.agencyLinks ?? [])
        .map((a) => `${a.agencyName} ${a.quoteSummary ?? ""}`)
        .join(" ");
      const hay = [
        l.travelerName,
        l.email,
        l.tripSummary,
        l.assignedAgency,
        l.source,
        l.budget,
        l.referentId,
        agenciesHay,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, search]);

  const moveLeadToStatus = useCallback(
    async (leadId: string, status: LeadStatus) => {
      if (isUuid(leadId)) {
        const result = await updateLeadStatus(leadId, status);
        if (!result.ok) {
          window.alert(result.error);
          return;
        }
        router.refresh();
        return;
      }
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          if (l.status === status) return l;
          return {
            ...l,
            status,
            timeline: [
              timelineEntry(
                "Déplacement",
                `Déplacé vers « ${leadStatusLabelFr[status]} » (tableau).`,
              ),
              ...l.timeline,
            ],
          };
        }),
      );
    },
    [router],
  );

  const setLeadStatus = useCallback(
    (leadId: string, status: LeadStatus) => {
      void moveLeadToStatus(leadId, status);
    },
    [moveLeadToStatus],
  );

  const toggleStar = useCallback(
    async (leadId: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      if (isUuid(leadId)) {
        const result = await toggleLeadStarred(leadId, !lead.starred);
        if (!result.ok) {
          window.alert(result.error);
          return;
        }
        router.refresh();
        return;
      }
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, starred: !l.starred } : l,
        ),
      );
    },
    [leads, router],
  );

  const refreshLeads = useCallback(() => {
    void (async () => {
      const { leads: remote, error } = await fetchLeadsFromBrowser();
      if (!error) {
        setLeads(normalizeLeads(remote));
      }
      router.refresh();
    })();
  }, [router]);

  const addLeadAgencyConsultation = useCallback(
    (leadId: string, input: { agencyId: string; agencyName: string }) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const links = l.agencyLinks ?? [];
          if (links.some((x) => x.agencyId === input.agencyId)) return l;
          const linkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newLink = {
            id: linkId,
            agencyId: input.agencyId,
            agencyName: input.agencyName,
            status: "invited" as const,
          };
          return {
            ...l,
            agencyLinks: [...links, newLink],
            timeline: [
              timelineEntry(
                "Consultation agence",
                `Ajout au dossier : ${input.agencyName} (statut « ${agencyConsultationLabelFr.invited} »).`,
              ),
              ...l.timeline,
            ],
          };
        }),
      );
    },
    [],
  );

  const setLeadAgencyLinkStatus = useCallback(
    (leadId: string, linkId: string, status: AgencyConsultationStatus) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const links = l.agencyLinks ?? [];
          const target = links.find((x) => x.id === linkId);
          if (!target || target.status === status) return l;
          const nextLinks = links.map((x) =>
            x.id === linkId ? { ...x, status } : x,
          );
          return {
            ...l,
            agencyLinks: nextLinks,
            timeline: [
              timelineEntry(
                "Suivi agence",
                `${target.agencyName} : statut « ${agencyConsultationLabelFr[status]} ».`,
              ),
              ...l.timeline,
            ],
          };
        }),
      );
    },
    [],
  );

  const setLeadAgencyLinkQuote = useCallback(
    (leadId: string, linkId: string, quoteSummary: string) => {
      const trimmed = quoteSummary.trim();
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const links = l.agencyLinks ?? [];
          const target = links.find((x) => x.id === linkId);
          if (!target) return l;
          const nextLinks = links.map((x) =>
            x.id === linkId
              ? {
                  ...x,
                  quoteSummary: trimmed,
                  status: "quote_received" as const,
                }
              : x,
          );
          return {
            ...l,
            agencyLinks: nextLinks,
            quoteStatus:
              trimmed.length > 0 ? "Devis partenaire enregistré" : l.quoteStatus,
            timeline: [
              timelineEntry(
                "Devis agence",
                `${target.agencyName} : ${trimmed || "synthèse mise à jour."}`,
              ),
              ...l.timeline,
            ],
          };
        }),
      );
    },
    [],
  );

  const deleteLead = useCallback(
    async (leadId: string) => {
      if (isUuid(leadId)) {
        const result = await deleteLeadFromServer(leadId);
        if (!result.ok) {
          window.alert(result.error);
          return;
        }
        refreshLeads();
        router.refresh();
        return;
      }
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    },
    [refreshLeads, router],
  );

  const setRetainedAgencyForLead = useCallback(
    (
      leadId: string,
      retainedAgencyId: string | null,
      retainedDisplayName: string | null,
    ) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          if (retainedAgencyId && retainedDisplayName) {
            return {
              ...l,
              retainedAgencyId,
              assignedAgency: retainedDisplayName,
              timeline: [
                timelineEntry(
                  "Arbitrage DA",
                  `Agence retenue pour la suite : ${retainedDisplayName}.`,
                ),
                ...l.timeline,
              ],
            };
          }
          return {
            ...l,
            retainedAgencyId: null,
            assignedAgency: "Non assignée",
            timeline: [
              timelineEntry(
                "Arbitrage DA",
                "Sélection d'agence retenue réinitialisée.",
              ),
              ...l.timeline,
            ],
          };
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      leads,
      filteredLeads,
      currentUserId,
      search,
      setSearch,
      moveLeadToStatus,
      setLeadStatus,
      toggleStar,
      refreshLeads,
      addLeadAgencyConsultation,
      setLeadAgencyLinkStatus,
      setLeadAgencyLinkQuote,
      setRetainedAgencyForLead,
      deleteLead,
    }),
    [
      leads,
      filteredLeads,
      currentUserId,
      search,
      moveLeadToStatus,
      setLeadStatus,
      toggleStar,
      refreshLeads,
      addLeadAgencyConsultation,
      setLeadAgencyLinkStatus,
      setLeadAgencyLinkQuote,
      setRetainedAgencyForLead,
      deleteLead,
    ],
  );

  return (
    <LeadsDemoContext.Provider value={value}>{children}</LeadsDemoContext.Provider>
  );
}

export function useLeadsDemo() {
  const ctx = useContext(LeadsDemoContext);
  if (!ctx) {
    throw new Error("useLeadsDemo doit être utilisé sous LeadsDemoProvider");
  }
  return ctx;
}
