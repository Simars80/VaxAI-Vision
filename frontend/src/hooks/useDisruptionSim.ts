import { useState, useCallback } from "react";
import { runDisruptionSimulation } from "@/api/routes";
import { createLogger } from "@/lib/logger";
import type { SimulationResult, SimulationLoadState } from "@/types/logistics";

const logger = createLogger("useDisruptionSim");

interface UseDisruptionSimResult {
  disruptedNodeIds: string[];
  simState: SimulationLoadState;
  simError: string | null;
  simResult: SimulationResult | null;
  toggleNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  runSimulation: (countryCode: string) => void;
  clearAll: () => void;
}

export function useDisruptionSim(): UseDisruptionSimResult {
  const [disruptedNodeIds, setDisruptedNodeIds] = useState<string[]>([]);
  const [simState, setSimState] = useState<SimulationLoadState>("idle");
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  const toggleNode = useCallback((nodeId: string) => {
    setDisruptedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    );
    // Reset previous result when disruption set changes.
    setSimResult(null);
    setSimState("idle");
    setSimError(null);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setDisruptedNodeIds((prev) => prev.filter((id) => id !== nodeId));
    setSimResult(null);
    setSimState("idle");
    setSimError(null);
  }, []);

  const runSimulation = useCallback(
    (countryCode: string) => {
      if (disruptedNodeIds.length === 0) return;

      setSimState("loading");
      setSimError(null);

      logger.info("Running simulation", { countryCode, disruptedNodeIds });

      runDisruptionSimulation({ countryCode, disruptedNodeIds })
        .then((result) => {
          setSimResult(result);
          setSimState("done");
          logger.info("Simulation complete", { simulationId: result.simulationId });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Simulation failed";
          logger.error("Simulation error", { error: msg });
          setSimError(msg);
          setSimState("error");
        });
    },
    [disruptedNodeIds],
  );

  const clearAll = useCallback(() => {
    setDisruptedNodeIds([]);
    setSimState("idle");
    setSimError(null);
    setSimResult(null);
  }, []);

  return {
    disruptedNodeIds,
    simState,
    simError,
    simResult,
    toggleNode,
    removeNode,
    runSimulation,
    clearAll,
  };
}
