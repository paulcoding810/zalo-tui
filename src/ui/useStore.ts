import { createContext, useContext, useSyncExternalStore } from "react";
import type { State, Store } from "../store.ts";

export const StoreContext = createContext<Store | null>(null);

export function useStoreState(): State {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreContext missing");
  return useSyncExternalStore(store.subscribe, store.getState);
}
