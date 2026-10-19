"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  CanonicalField,
  ExtractedIdentity,
  PersonRecord,
} from "@/lib/types";
import { buildVerification, type VerificationOutput } from "@/lib/verification";
import type { CorrectionsMap } from "@/lib/excel/export";

const STORAGE_KEY = "list-checker-session-v1";

interface SessionState {
  finalRecords: PersonRecord[];
  mainRecords: PersonRecord[];
  identities: ExtractedIdentity[];
  corrections: CorrectionsMap;
  warnings: string[];
}

const emptyState: SessionState = {
  finalRecords: [],
  mainRecords: [],
  identities: [],
  corrections: {},
  warnings: [],
};

interface StoreValue extends SessionState {
  verification: VerificationOutput;
  setFinalRecords: (records: PersonRecord[]) => void;
  addFinalRecords: (records: PersonRecord[]) => void;
  setMainRecords: (records: PersonRecord[]) => void;
  setIdentities: (identities: ExtractedIdentity[]) => void;
  addIdentities: (identities: ExtractedIdentity[]) => void;
  addWarnings: (warnings: string[]) => void;
  setCorrection: (recordId: string, field: CanonicalField, value: string) => void;
  clearCorrection: (recordId: string, field: CanonicalField) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  // Sessiya yaddaşından bərpa (yeniləmədən sonra itməsin).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...emptyState, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore (kvota) */
    }
  }, [state, hydrated]);

  const verification = useMemo(
    () =>
      buildVerification({
        finalRecords: state.finalRecords,
        mainRecords: state.mainRecords,
        identities: state.identities,
      }),
    [state.finalRecords, state.mainRecords, state.identities],
  );

  const setFinalRecords = useCallback((records: PersonRecord[]) => {
    setState((s) => ({ ...s, finalRecords: records }));
  }, []);
  const addFinalRecords = useCallback((records: PersonRecord[]) => {
    setState((s) => ({ ...s, finalRecords: [...s.finalRecords, ...records] }));
  }, []);
  const setMainRecords = useCallback((records: PersonRecord[]) => {
    setState((s) => ({ ...s, mainRecords: records }));
  }, []);
  const setIdentities = useCallback((identities: ExtractedIdentity[]) => {
    setState((s) => ({ ...s, identities }));
  }, []);
  const addIdentities = useCallback((identities: ExtractedIdentity[]) => {
    setState((s) => ({ ...s, identities: [...s.identities, ...identities] }));
  }, []);
  const addWarnings = useCallback((warnings: string[]) => {
    setState((s) => ({ ...s, warnings: [...s.warnings, ...warnings] }));
  }, []);
  const setCorrection = useCallback((recordId: string, field: CanonicalField, value: string) => {
    setState((s) => ({
      ...s,
      corrections: {
        ...s.corrections,
        [recordId]: { ...(s.corrections[recordId] ?? {}), [field]: value },
      },
    }));
  }, []);
  const clearCorrection = useCallback((recordId: string, field: CanonicalField) => {
    setState((s) => {
      const rec = { ...(s.corrections[recordId] ?? {}) };
      delete rec[field];
      return { ...s, corrections: { ...s.corrections, [recordId]: rec } };
    });
  }, []);
  const resetAll = useCallback(() => {
    setState(emptyState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value: StoreValue = {
    ...state,
    verification,
    setFinalRecords,
    addFinalRecords,
    setMainRecords,
    setIdentities,
    addIdentities,
    addWarnings,
    setCorrection,
    clearCorrection,
    resetAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore StoreProvider daxilində istifadə olunmalıdır.");
  return ctx;
}
