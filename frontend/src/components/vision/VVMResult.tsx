import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { VVMScanResult, VVMStage } from "@/api/vision";
import { VVM_STAGE_INFO } from "@/api/vision";

interface VVMResultProps {
  result: VVMScanResult;
  modelVersion?: string;
}

function StageIndicator({ stage }: { stage: VVMStage }) {
  const info = VVM_STAGE_INFO[stage];
  const stageNum = parseInt(stage.replace("stage_", ""));

  return (
    <div className="flex items-center gap-3">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
              n === stageNum
                ? "scale-125 shadow-lg"
                : "opacity-30"
            }`}
            style={{
              borderColor: n === stageNum ? info.color : "#d1d5db",
              backgroundColor: n === stageNum ? info.color + "20" : "transparent",
              color: n === stageNum ? info.color : "#9ca3af",
            }}
          >
            {n}
          </div>
          <span className={`text-[10px] ${n === stageNum ? "font-semibold" : "text-muted-foreground"}`}>
            Stage {n}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? "#22c55e" : pct >= 70 ? "#eab308" : "#ef4444";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function VVMResult({ result, modelVersion }: VVMResultProps) {
  const info = VVM_STAGE_INFO[result.classification];

  return (
    <Card className="border-2" style={{ borderColor: info.color + "40" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            VVM Classification Result
          </CardTitle>
          <Badge
            className="gap-1"
            style={{
              backgroundColor: result.usable ? "#dcfce7" : "#fef2f2",
              color: result.usable ? "#166534" : "#991b1b",
              borderColor: result.usable ? "#86efac" : "#fca5a5",
            }}
          >
            {result.usable ? (
              <><CheckCircle className="h-3 w-3" /> Usable</>
            ) : (
              <><XCircle className="h-3 w-3" /> Do Not Use</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex justify-center">
          <StageIndicator stage={result.classification} />
        </div>

        <div className="rounded-lg p-4" style={{ backgroundColor: info.color + "10" }}>
          <div className="flex items-start gap-3">
            {result.usable ? (
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: info.color }} />
            ) : (
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: info.color }} />
            )}
            <div>
              <p className="font-semibold" style={{ color: info.color }}>
                {info.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {info.description}
              </p>
              {!result.usable && (
                <p className="text-sm font-medium mt-2 text-destructive">
                  Recommendation: Remove from stock and report to supervisor
                </p>
              )}
            </div>
          </div>
        </div>

        <ConfidenceBar confidence={result.confidence} />

        {modelVersion && (
          <p className="text-xs text-muted-foreground text-right">
            Model: {modelVersion}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
