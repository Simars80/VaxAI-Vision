import { Polyline, Tooltip } from "react-leaflet";
import type { DAGEdge, DAGNode } from "@/types/logistics";

interface Props {
  edges: DAGEdge[];
  nodes: DAGNode[];
  disruptedNodeIds: string[];
  /** Alternative edges from simulation result */
  alternativeEdgeIds?: Set<string>;
}

function edgeStyle(edge: DAGEdge, disruptedNodeIds: string[], alternativeEdgeIds: Set<string>) {
  if (alternativeEdgeIds.has(edge.id)) {
    return { color: "#22c55e", weight: 3, dashArray: "8 6", opacity: 0.9 };
  }
  const isDisrupted =
    edge.disrupted ||
    disruptedNodeIds.includes(edge.source) ||
    disruptedNodeIds.includes(edge.target);
  if (isDisrupted) {
    return { color: "#ef4444", weight: 2.5, dashArray: undefined, opacity: 0.85 };
  }
  return { color: "#3b82f6", weight: 2, dashArray: undefined, opacity: 0.7 };
}

export function DAGEdgeLayer({ edges, nodes, disruptedNodeIds, alternativeEdgeIds = new Set() }: Props) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <>
      {edges.map((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;

        const style = edgeStyle(edge, disruptedNodeIds, alternativeEdgeIds);

        return (
          <Polyline
            key={edge.id}
            positions={[
              [src.lat, src.lng],
              [tgt.lat, tgt.lng],
            ]}
            pathOptions={style}
          >
            <Tooltip sticky>
              {src.name} → {tgt.name}
              <br />
              Transit: {edge.transitHours}h
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
