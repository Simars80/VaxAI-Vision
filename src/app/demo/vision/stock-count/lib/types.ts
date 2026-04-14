export interface Detection {
  id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  color: string;
  category: string;
}

export interface ProductTally {
  category: string;
  label: string;
  count: number;
  color: string;
}

export interface StockSession {
  id: string;
  name: string;
  status: "active" | "paused" | "submitted" | "draft";
  startedAt: string;
  submittedAt?: string;
  detections: Detection[];
  tallies: ProductTally[];
  facility: string;
  notes?: string;
}

export interface ReconciliationRow {
  productName: string;
  category: string;
  systemCount: number;
  scannedCount: number;
  discrepancy: number;
  status: "match" | "over" | "under";
}
