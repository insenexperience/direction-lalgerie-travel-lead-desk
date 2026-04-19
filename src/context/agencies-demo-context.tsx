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
import type {
  CreatePartnerAgencyInput,
  PartnerAgency,
} from "@/lib/mock-agencies";
import { seedPartnerAgencies } from "@/lib/mock-agencies";

const STORAGE_KEY = "dla-agencies-v1";

function cloneSeed(): PartnerAgency[] {
  return JSON.parse(JSON.stringify(seedPartnerAgencies)) as PartnerAgency[];
}

function loadStored(): PartnerAgency[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as PartnerAgency[];
  } catch {
    return null;
  }
}

export type { CreatePartnerAgencyInput };

type AgenciesDemoContextValue = {
  agencies: PartnerAgency[];
  getAgencyById: (id: string) => PartnerAgency | undefined;
  addAgency: (input: CreatePartnerAgencyInput) => PartnerAgency;
};

const AgenciesDemoContext = createContext<AgenciesDemoContextValue | null>(null);

export function AgenciesDemoProvider({ children }: { children: ReactNode }) {
  const [agencies, setAgencies] = useState<PartnerAgency[]>(() => cloneSeed());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored && stored.length > 0) {
      setAgencies(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agencies));
    } catch {
      /* ignore quota */
    }
  }, [agencies, hydrated]);

  const getAgencyById = useCallback(
    (id: string) => agencies.find((a) => a.id === id),
    [agencies],
  );

  const addAgency = useCallback((input: CreatePartnerAgencyInput) => {
    const id = `agency-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString().slice(0, 10);
    const next: PartnerAgency = {
      id,
      legalName: input.legalName.trim(),
      tradeName: input.tradeName?.trim() || undefined,
      type: input.type,
      country: input.country.trim(),
      city: input.city.trim(),
      website: input.website?.trim() || undefined,
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      destinations: input.destinations.trim(),
      languages: input.languages.trim(),
      segments: input.segments.trim(),
      slaQuoteDays: input.slaQuoteDays,
      status: input.status,
      internalNotes: input.internalNotes?.trim() || undefined,
      createdAt,
    };
    setAgencies((prev) => [next, ...prev]);
    return next;
  }, []);

  const value = useMemo(
    () => ({
      agencies,
      getAgencyById,
      addAgency,
    }),
    [agencies, getAgencyById, addAgency],
  );

  return (
    <AgenciesDemoContext.Provider value={value}>{children}</AgenciesDemoContext.Provider>
  );
}

export function useAgenciesDemo() {
  const ctx = useContext(AgenciesDemoContext);
  if (!ctx) {
    throw new Error("useAgenciesDemo doit être utilisé sous AgenciesDemoProvider");
  }
  return ctx;
}
