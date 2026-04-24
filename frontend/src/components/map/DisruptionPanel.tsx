import { Loader2, AlertTriangle, X, Play, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PropagationResultOverlay } from "./PropagationResultOverlay";
import type { SimulationLoadState, SimulationResult } from "@/types/logistics";
import type { DAGNode } from "@/types/logistics";

interface Props {
  disruptedNodeIds: string[];
  nodes: DAGNode[];
  simState: SimulationLoadState;
  simError: string | null;
  simResult: SimulationResult | null;
  countryCode: string;
  onRemoveNode: (nodeId: string) => void;
  onRunSimulation: (countryCode: string) => void;
  onClearAll: () => void;
  onOpenNarrative: () => void;
}

export function DisruptionPanel({
  disruptedNodeIds,
  nodes,
  simState,
  simError,
  simResult,
  countryCode,
  onRemoveNode,
  onRunSimulation,
  onClearAll,
  onOpenNarrative,
}: Props) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  if (disruptedNodeIds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <p className="text-xs text-muted-foreground text-center">
            Click nodes on the map to mark disruptions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Disrupted Nodes ({disruptedNodeIds.length})</span>
          <button
            onClick={onClearAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Clear all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {disruptedNodeIds.map((id) => {
            const node = nodeMap.get(id);
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1"
              >
                <span className="truncate font-medium text-red-800">
                  {node?.name ?? id}
                </span>
                <button
                  onClick={() => onRemoveNode(id)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {simError && (
          <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {simError}
          </div>
        )}

        {simResult && (
          <div className="space-y-2">
            <PropagationResultOverlay result={simResult} />
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={onOpenNarrative}
            >
              View AI Narrative
            </Button>
          </div>
        )}

        <Button
          size="sm"
          className="w-full text-xs h-7"
          disabled={simState === "loading" || disruptedNodeIds.length === 0}
          onClick={() => onRunSimulation(countryCode)}
        >
          {simState === "loading" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Simulating…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 mr-1" />
              Run Simulation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
