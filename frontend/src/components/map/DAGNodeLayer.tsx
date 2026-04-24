import { CircleMarker, Popup } from "react-leaflet";
import type { DAGNode, NodeLevel } from "@/types/logistics";

const RADIUS_BY_LEVEL: Record<NodeLevel, number> = {
  national: 12,
  regional: 9,
  district: 7,
  facility: 5,
};

interface Props {
  nodes: DAGNode[];
  disruptedNodeIds: string[];
  affectedNodeIds?: Set<string>;
  onToggleNode: (nodeId: string) => void;
}

function nodeColor(node: DAGNode, disruptedNodeIds: string[], affectedNodeIds: Set<string>): string {
  if (affectedNodeIds.has(node.id)) return "#f97316";
  if (disruptedNodeIds.includes(node.id)) return "#ef4444";
  return "#6366f1";
}

export function DAGNodeLayer({ nodes, disruptedNodeIds, affectedNodeIds = new Set(), onToggleNode }: Props) {
  return (
    <>
      {nodes.map((node) => {
        const isDisrupted = disruptedNodeIds.includes(node.id);
        const color = nodeColor(node, disruptedNodeIds, affectedNodeIds);

        return (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={RADIUS_BY_LEVEL[node.level]}
            pathOptions={{
              fillColor: color,
              color: "#fff",
              weight: 1.5,
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onToggleNode(node.id) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>{node.name}</p>
                <p style={{ fontSize: 12, color: "#666" }}>Level: {node.level}</p>
                <p style={{ fontSize: 12 }}>Population: {node.population.toLocaleString()}</p>
                <p style={{ fontSize: 12 }}>Coverage: {node.coverageRate}%</p>
                <button
                  onClick={() => onToggleNode(node.id)}
                  style={{
                    marginTop: 8,
                    padding: "4px 10px",
                    fontSize: 12,
                    borderRadius: 4,
                    border: "1px solid",
                    cursor: "pointer",
                    backgroundColor: isDisrupted ? "#fef2f2" : "#fafafa",
                    borderColor: isDisrupted ? "#ef4444" : "#d1d5db",
                    color: isDisrupted ? "#dc2626" : "#374151",
                  }}
                >
                  {isDisrupted ? "Restore" : "Simulate Disruption"}
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
