"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Form draft that starts from the saved value and follows it when the saved value changes
 * (for example when saved demo-state loads after the first render). Local edits stay until then.
 */
export function useSyncedDraft<T>(saved: T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState(saved);
  const [previous, setPrevious] = useState(saved);
  if (previous !== saved) {
    setPrevious(saved);
    setDraft(saved);
  }
  return [draft, setDraft];
}

export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
