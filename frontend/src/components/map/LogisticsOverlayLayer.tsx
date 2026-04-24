import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useLogisticsDAG } from "@/hooks/useLogisticsDAG";
import { useDisruptionSim } from "@/hooks/useDisruptionSim";
import { DAGEdgeLayer } from "./DAGEdgeLayer";
import { DAGNodeLayer } from "./DAGNodeLayer";
import { DisruptionPanel } from "./DisruptionPanel";
import { NarrativeDrawer } from "./NarrativeDrawer";

interface Props {
  countryCode: string;
  enabled: boolean;
}

interface MapErrorBannerProps {
  message: string;
}

function MapErrorBanner({ message }: MapErrorBannerProps) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 text-xs rounded-md px-3 py-2 shadow-md">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      {message}
    </div>
  );
}

function MapSpinner() {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/90 border border-gray-200 text-gray-600 text-xs rounded-md px-3 py-2 shadow-md">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Loading routes…
    </div>
  );
}

export interface LogisticsOverlayHandle {
  panel: React.ReactNode;
}

interface LogisticsOverlayLayerProps extends Props {
  /** Callback that provides the sidebar panel React node to parent. */
  onPanelChange: (panel: React.ReactNode) => void;
}

export function LogisticsOverlayLayer({
  countryCode,
  enabled,
  onPanelChange,
}: LogisticsOverlayLayerProps) {
  const { dag, dagState, error, load, clear } = useLogisticsDAG();
  const {
    disruptedNodeIds,
    simState,
    simError,
    simResult,
    toggleNode,
    removeNode,
    runSimulation,
    clearAll,
  } = useDisruptionSim();

  const [narrativeOpen, setNarrativeOpen] = useState(false);

  // Load or clear DAG when toggle changes.
  useEffect(() => {
    if (enabled) {
      load(countryCode);
    } else {
      clear();
      clearAll();
      setNarrativeOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, countryCode]);

  // Build affected/alternative sets from simulation result.
  const affectedNodeIds = new Set(
    (simResult?.affectedNodes ?? []).map((n) => n.nodeId),
  );
  const alternativeEdgeIds = new Set(
    (simResult?.alternativeRoutes ?? []).map((r) => r.edgeId),
  );

  // Push panel to parent whenever relevant state changes.
  useEffect(() => {
    if (!enabled) {
      onPanelChange(null);
      return;
    }
    onPanelChange(
      <DisruptionPanel
        disruptedNodeIds={disruptedNodeIds}
        nodes={dag?.nodes ?? []}
        simState={simState}
        simError={simError}
        simResult={simResult}
        countryCode={countryCode}
        onRemoveNode={removeNode}
        onRunSimulation={runSimulation}
        onClearAll={clearAll}
        onOpenNarrative={() => setNarrativeOpen(true)}
      />,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, disruptedNodeIds, dag, simState, simError, simResult, countryCode]);

  if (!enabled) return null;

  return (
    <>
      {dagState === "loading" && <MapSpinner />}
      {dagState === "error" && error && <MapErrorBanner message={error} />}

      {dagState === "ready" && dag && (
        <>
          <DAGEdgeLayer
            edges={dag.edges}
            nodes={dag.nodes}
            disruptedNodeIds={disruptedNodeIds}
            alternativeEdgeIds={alternativeEdgeIds}
          />
          <DAGNodeLayer
            nodes={dag.nodes}
            disruptedNodeIds={disruptedNodeIds}
            affectedNodeIds={affectedNodeIds}
            onToggleNode={toggleNode}
          />
        </>
      )}

      {narrativeOpen && simResult && (
        <NarrativeDrawer
          simulationId={simResult.simulationId}
          open={narrativeOpen}
          onClose={() => setNarrativeOpen(false)}
        />
      )}
    </>
  );
}
