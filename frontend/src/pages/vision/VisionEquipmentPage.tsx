import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import EquipmentReport from "@/components/vision/EquipmentReport";

export default function VisionEquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/vision">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Equipment Inspection</h1>
          <p className="text-sm text-muted-foreground">
            Capture equipment photos for AI-powered condition assessment
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <EquipmentReport />
      </div>
    </div>
  );
}
