// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMockResponse(url: string, _params?: any): any {
  if (url.includes("/vision/scans/history")) {
    const stages = ["stage_1", "stage_2", "stage_1", "stage_3", "stage_1", "stage_2", "stage_4", "stage_1", "stage_2", "stage_1"] as const;
    return {
      scans: stages.map((stage, i) => ({
        id: `demo-scan-${i}`,
        facility_id: `facility-${(i % 5) + 1}`,
        facility_name: ["Kano General Hospital", "Lagos Central Clinic", "Abuja Health Centre", "Ibadan District", "Kaduna Primary"][i % 5],
        classification: stage,
        confidence: [0.94, 0.87, 0.91, 0.78, 0.96, 0.89, 0.72, 0.93, 0.85, 0.97][i],
        usable: stage === "stage_1" || stage === "stage_2",
        scan_type: "vvm",
        scanned_at: new Date(Date.now() - i * 3600000 * 4).toISOString(),
      })),
      total: 10,
    };
  }

  if (url.includes("/vision/models/status")) {
    return {
      models: [
        { name: "VVM Classifier", version: "0.1.0-placeholder", loaded: true, backend: "cpu" },
        { name: "Equipment Inspector", version: "0.1.0-placeholder", loaded: true, backend: "placeholder" },
      ],
    };
  }

  if (url.includes("/vision/vvm/scan")) {
    const stages = ["stage_1", "stage_2", "stage_3", "stage_4"] as const;
    const idx = Math.floor(Math.random() * 4);
    return {
      result: {
        classification: stages[idx],
        confidence: 0.75 + Math.random() * 0.2,
        image_hash: Math.random().toString(36).slice(2, 18),
        usable: idx < 2,
      },
      model_version: "0.1.0-placeholder",
    };
  }

  if (url.includes("/vision/equipment/inspect")) {
    return {
      result: {
        status: "operational",
        details: "No visible damage detected. Equipment appears to be in working condition.",
        image_hash: Math.random().toString(36).slice(2, 18),
      },
      model_version: "0.1.0-placeholder",
    };
  }

  return undefined;
}
