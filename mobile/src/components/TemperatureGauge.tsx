import { View, Text, StyleSheet } from "react-native";
import type { ColdChainReading } from "@/api/coldchain";

interface TemperatureGaugeProps {
  readings: ColdChainReading[];
  label?: string;
  /** WHO vaccine storage range: 2-8°C */
  minTemp?: number;
  maxTemp?: number;
}

const WHO_MIN = 2;
const WHO_MAX = 8;

/**
 * Displays a horizontal temperature gauge for cold chain readings.
 * Shows the WHO safe zone (2–8°C) and marks each reading.
 */
export function TemperatureGauge({
  readings,
  label = "Temperature Readings",
  minTemp = -10,
  maxTemp = 30,
}: TemperatureGaugeProps) {
  if (readings.length === 0) return null;

  const range = maxTemp - minTemp;

  function toPercent(temp: number): number {
    return Math.max(0, Math.min(100, ((temp - minTemp) / range) * 100));
  }

  const safeZoneLeft = toPercent(WHO_MIN);
  const safeZoneWidth = toPercent(WHO_MAX) - safeZoneLeft;

  const latestTemp = readings[readings.length - 1]?.temp_celsius ?? 0;
  const latestStatus = readings[readings.length - 1]?.status ?? "normal";

  const tempColor =
    latestStatus === "breach"
      ? "#ef4444"
      : latestStatus === "warning"
      ? "#f97316"
      : "#22c55e";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.currentTemp, { color: tempColor }]}>
          {latestTemp.toFixed(1)}°C
        </Text>
      </View>

      {/* Gauge bar */}
      <View style={styles.gaugeContainer}>
        {/* Background track */}
        <View style={styles.track}>
          {/* Safe zone overlay */}
          <View
            style={[
              styles.safeZone,
              {
                left: `${safeZoneLeft}%`,
                width: `${safeZoneWidth}%`,
              },
            ]}
          />

          {/* Reading markers */}
          {readings.map((reading, idx) => {
            const pct = toPercent(reading.temp_celsius);
            const markerColor =
              reading.status === "breach"
                ? "#ef4444"
                : reading.status === "warning"
                ? "#f97316"
                : "#22c55e";
            return (
              <View
                key={`${reading.sensor_id}-${reading.timestamp}-${idx}`}
                style={[
                  styles.marker,
                  {
                    left: `${pct}%`,
                    backgroundColor: markerColor,
                    opacity: idx === readings.length - 1 ? 1 : 0.5,
                    width: idx === readings.length - 1 ? 14 : 8,
                    height: idx === readings.length - 1 ? 14 : 8,
                    borderRadius: idx === readings.length - 1 ? 7 : 4,
                    marginLeft: idx === readings.length - 1 ? -7 : -4,
                    zIndex: idx === readings.length - 1 ? 2 : 1,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Scale labels */}
        <View style={styles.scale}>
          <Text style={styles.scaleLabel}>{minTemp}°C</Text>
          <Text style={[styles.scaleLabel, { color: "#22c55e" }]}>
            WHO: {WHO_MIN}–{WHO_MAX}°C
          </Text>
          <Text style={styles.scaleLabel}>{maxTemp}°C</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color="#22c55e" label="Normal" />
        <LegendItem color="#f97316" label="Warning" />
        <LegendItem color="#ef4444" label="Breach" />
        <LegendItem color="#dcfce7" label="WHO Safe Zone" border="#22c55e" />
      </View>

      {/* Readings summary */}
      <View style={styles.summary}>
        <SummaryItem label="Min" value={`${Math.min(...readings.map((r) => r.temp_celsius)).toFixed(1)}°C`} />
        <SummaryItem label="Max" value={`${Math.max(...readings.map((r) => r.temp_celsius)).toFixed(1)}°C`} />
        <SummaryItem
          label="Avg"
          value={`${(readings.reduce((s, r) => s + r.temp_celsius, 0) / readings.length).toFixed(1)}°C`}
        />
        <SummaryItem label="Readings" value={String(readings.length)} />
      </View>
    </View>
  );
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <View style={legendStyles.item}>
      <View
        style={[
          legendStyles.dot,
          { backgroundColor: color },
          border ? { borderWidth: 1, borderColor: border } : {},
        ]}
      />
      <Text style={legendStyles.label}>{label}</Text>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryStyles.item}>
      <Text style={summaryStyles.value}>{value}</Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  currentTemp: {
    fontSize: 24,
    fontWeight: "700",
  },
  gaugeContainer: {
    marginBottom: 10,
  },
  track: {
    height: 16,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    position: "relative",
    overflow: "visible",
    marginBottom: 4,
  },
  safeZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "#dcfce7",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  marker: {
    position: "absolute",
    top: 1,
  },
  scale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleLabel: {
    fontSize: 10,
    color: "#94a3b8",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  summary: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
});

const legendStyles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 11, color: "#64748b" },
});

const summaryStyles = StyleSheet.create({
  item: { flex: 1, alignItems: "center" },
  value: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  label: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
});
