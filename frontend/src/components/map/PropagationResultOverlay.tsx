import { Badge } from "@/components/ui/badge";
import type { SimulationResult } from "@/types/logistics";

interface Props {
  result: SimulationResult;
}

export function PropagationResultOverlay({ result }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
        {result.affectedNodes.length} node{result.affectedNodes.length !== 1 ? "s" : ""} affected
      </Badge>
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
        {result.totalPopulationImpacted.toLocaleString()} people impacted
      </Badge>
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
        Coverage Δ {result.totalCoverageDelta > 0 ? "+" : ""}
        {result.totalCoverageDelta.toFixed(1)}%
      </Badge>
      {result.alternativeRoutes.length > 0 && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
          {result.alternativeRoutes.length} alternative route
          {result.alternativeRoutes.length !== 1 ? "s" : ""} found
        </Badge>
      )}
    </div>
  );
}
