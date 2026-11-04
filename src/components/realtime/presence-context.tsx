"use client";

import { createContext, useContext } from "react";

type PresenceContextValue = {
  onlineIds: Set<string>;
};

const PresenceContext = createContext<PresenceContextValue>({ onlineIds: new Set() });

export function PresenceProvider({
  onlineIds,
  children,
}: {
  onlineIds: Set<string>;
  children: React.ReactNode;
}) {
  return <PresenceContext.Provider value={{ onlineIds }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}
