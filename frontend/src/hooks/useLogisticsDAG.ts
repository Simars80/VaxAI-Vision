import { useState, useCallback, useRef } from "react";
import { fetchLogisticsDAG } from "@/api/routes";
import { createLogger } from "@/lib/logger";
import type { LogisticsDAG, DAGLoadState } from "@/types/logistics";

const logger = createLogger("useLogisticsDAG");

// Simple in-memory cache keyed by country code. Lives for the lifetime of the
// browser session so repeated toggles don't re-fetch from the network.
const dagCache = new Map<string, LogisticsDAG>();

interface UseLogisticsDAGResult {
  dag: LogisticsDAG | null;
  dagState: DAGLoadState;
  error: string | null;
  load: (countryCode: string) => void;
  clear: () => void;
}

export function useLogisticsDAG(): UseLogisticsDAGResult {
  const [dag, setDag] = useState<LogisticsDAG | null>(null);
  const [dagState, setDagState] = useState<DAGLoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((countryCode: string) => {
    // Return cached result immediately if available.
    const cached = dagCache.get(countryCode);
    if (cached) {
      logger.debug("Cache hit", { countryCode });
      setDag(cached);
      setDagState("ready");
      setError(null);
      return;
    }

    // Cancel any in-flight request.
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setDagState("loading");
    setError(null);

    logger.info("Fetching DAG", { countryCode });

    fetchLogisticsDAG(countryCode)
      .then((data) => {
        dagCache.set(countryCode, data);
        setDag(data);
        setDagState("ready");
        logger.info("DAG loaded", { countryCode, nodes: data.nodes.length, edges: data.edges.length });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to load logistics routes";
        logger.error("DAG fetch failed", { countryCode, error: msg });
        setError(msg);
        setDagState("error");
      });
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setDag(null);
    setDagState("idle");
    setError(null);
  }, []);

  return { dag, dagState, error, load, clear };
}
