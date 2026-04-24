// TypeScript types mirroring the backend Pydantic models for the logistics
// route management system.

export type NodeLevel = "national" | "regional" | "district" | "facility";

export interface DAGNode {
  id: string;
  name: string;
  level: NodeLevel;
  lat: number;
  lng: number;
  population: number;
  /** Coverage rate 0–100 */
  coverageRate: number;
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  /** Transit time in hours */
  transitHours: number;
  /** Whether this edge is currently disrupted */
  disrupted: boolean;
  /** Whether this is an alternative route computed by simulation */
  alternative: boolean;
}

export interface LogisticsDAG {
  countryCode: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
}

export type DAGLoadState = "idle" | "loading" | "error" | "ready";

// ── Simulation ────────────────────────────────────────────────────────────

export interface SimulationRequest {
  countryCode: string;
  disruptedNodeIds: string[];
}

export interface AffectedNode {
  nodeId: string;
  populationImpacted: number;
  coverageDelta: number;
}

export interface AlternativeRoute {
  edgeId: string;
  source: string;
  target: string;
  transitHours: number;
}

export interface SimulationResult {
  simulationId: string;
  affectedNodes: AffectedNode[];
  alternativeRoutes: AlternativeRoute[];
  totalPopulationImpacted: number;
  totalCoverageDelta: number;
}

export type SimulationLoadState = "idle" | "loading" | "error" | "done";
