import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { scanVVM, inspectEquipment, VVM_STAGE_INFO, type VVMScanResponse, type EquipmentInspectionResponse } from "@/api/vision";
import { parseVaccineBarcode, type ParsedVaccineBarcode } from "@/lib/barcode";
import { OfflineBanner } from "@/components/OfflineBanner";

type ScanMode = "vvm" | "barcode" | "equipment";
type ScanState = "idle" | "scanning" | "processing" | "result";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState(false);
  const [vvmResult, setVvmResult] = useState<VVMScanResponse | null>(null);
  const [equipmentResult, setEquipmentResult] = useState<EquipmentInspectionResponse | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<ParsedVaccineBarcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<number>(0);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={56} color="#94a3b8" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>
          VaxAI Vision needs camera access to scan VVMs and barcodes.
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function handleBarcodeScan(result: BarcodeScanningResult) {
    // Debounce: ignore scans within 2 seconds of the last one
    const now = Date.now();
    if (now - lastScanRef.current < 2000) return;
    lastScanRef.current = now;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const parsed = parseVaccineBarcode(result.data);
    setBarcodeResult(parsed);
    setScanState("result");
  }

  async function handleCaptureForVision() {
    setScanState("processing");
    setError(null);

    try {
      // Use image picker to capture from camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) {
        setScanState("idle");
        return;
      }

      const imageUri = result.assets[0].uri;

      if (mode === "vvm") {
        const scanResult = await scanVVM(imageUri);
        setVvmResult(scanResult);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (mode === "equipment") {
        const inspResult = await inspectEquipment(imageUri);
        setEquipmentResult(inspResult);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setScanState("result");
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
      setScanState("idle");
    }
  }

  function resetScan() {
    setScanState("idle");
    setVvmResult(null);
    setEquipmentResult(null);
    setBarcodeResult(null);
    setError(null);
    lastScanRef.current = 0;
  }

  return (
    <View style={styles.root}>
      <OfflineBanner />

      {/* Mode switcher */}
      <View style={styles.modeBar}>
        <ModeButton label="Barcode" icon="barcode-outline" active={mode === "barcode"} onPress={() => { setMode("barcode"); resetScan(); }} />
        <ModeButton label="VVM" icon="eye-outline" active={mode === "vvm"} onPress={() => { setMode("vvm"); resetScan(); }} />
        <ModeButton label="Equipment" icon="construct-outline" active={mode === "equipment"} onPress={() => { setMode("equipment"); resetScan(); }} />
      </View>

      {/* Camera view — always mounted so it stays live */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={flash}
          barcodeScannerSettings={
            mode === "barcode"
              ? {
                  barcodeTypes: [
                    "datamatrix",
                    "qr",
                    "code128",
                    "code39",
                    "ean13",
                    "ean8",
                    "gs1DataBar",
                  ],
                }
              : undefined
          }
          onBarcodeScanned={mode === "barcode" && scanState !== "result" ? handleBarcodeScan : undefined}
        />

        {/* Viewfinder overlay */}
        <View style={styles.overlay}>
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={[
              styles.scanFrame,
              mode === "vvm" && styles.scanFrameCircle,
            ]}>
              {scanState === "processing" && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.processingText}>Analyzing...</Text>
                </View>
              )}
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <Text style={styles.hintText}>
              {mode === "barcode"
                ? "Align barcode within frame"
                : mode === "vvm"
                ? "Center VVM dot in frame, then capture"
                : "Frame the equipment, then capture"}
            </Text>
          </View>
        </View>

        {/* Camera controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFlash(!flash)}
          >
            <Ionicons
              name={flash ? "flash" : "flash-outline"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          {mode !== "barcode" && (
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={handleCaptureForVision}
              disabled={scanState === "processing"}
            >
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFacing(facing === "back" ? "front" : "back")}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Result modals */}
      <BarcodeResultModal
        visible={scanState === "result" && mode === "barcode"}
        result={barcodeResult}
        onClose={resetScan}
      />

      <VVMResultModal
        visible={scanState === "result" && mode === "vvm"}
        result={vvmResult}
        onClose={resetScan}
      />

      <EquipmentResultModal
        visible={scanState === "result" && mode === "equipment"}
        result={equipmentResult}
        onClose={resetScan}
      />
    </View>
  );
}

// ── Result modals ─────────────────────────────────────────────────────────────

function BarcodeResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: ParsedVaccineBarcode | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const daysLeft = result.expiryDate
    ? Math.ceil((new Date(result.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const expired = daysLeft !== null && daysLeft < 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={resultStyles.container}>
        <View style={resultStyles.header}>
          <Text style={resultStyles.title}>Barcode Scan Result</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={[resultStyles.statusBadge, result.isValid ? resultStyles.validBadge : resultStyles.unknownBadge]}>
          <Ionicons
            name={result.isValid ? "checkmark-circle" : "help-circle"}
            size={20}
            color={result.isValid ? "#22c55e" : "#94a3b8"}
          />
          <Text style={[resultStyles.statusText, { color: result.isValid ? "#22c55e" : "#94a3b8" }]}>
            {result.isValid ? "Valid GS1 Vaccine Barcode" : "Unknown Format"}
          </Text>
        </View>

        <ScrollView style={resultStyles.fields}>
          {result.gtin && <ResultField label="GTIN" value={result.gtin} />}
          {result.lotNumber && <ResultField label="Lot Number" value={result.lotNumber} />}
          {result.expiryDate && (
            <ResultField
              label="Expiry Date"
              value={`${result.expiryDate}${daysLeft !== null ? (expired ? " (EXPIRED)" : ` (${daysLeft}d remaining)`) : ""}`}
              valueColor={expired ? "#ef4444" : daysLeft !== null && daysLeft < 30 ? "#f97316" : undefined}
            />
          )}
          {result.serialNumber && <ResultField label="Serial Number" value={result.serialNumber} />}
          {result.productId && <ResultField label="Product ID" value={result.productId} />}
          <ResultField label="Raw Data" value={result.raw} mono />
        </ScrollView>

        <TouchableOpacity style={resultStyles.primaryButton} onPress={onClose}>
          <Text style={resultStyles.primaryButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function VVMResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: VVMScanResponse | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const stageInfo = VVM_STAGE_INFO[result.result.classification];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={resultStyles.container}>
        <View style={resultStyles.header}>
          <Text style={resultStyles.title}>VVM Scan Result</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={[resultStyles.vvmStage, { backgroundColor: `${stageInfo.color}18`, borderColor: stageInfo.color }]}>
          <View style={[resultStyles.stageIndicator, { backgroundColor: stageInfo.color }]} />
          <View style={resultStyles.stageInfo}>
            <Text style={[resultStyles.stageLabel, { color: stageInfo.color }]}>{stageInfo.label}</Text>
            <Text style={resultStyles.stageDescription}>{stageInfo.description}</Text>
          </View>
        </View>

        <View style={[resultStyles.usabilityBadge, result.result.usable ? resultStyles.usableBadge : resultStyles.unusableBadge]}>
          <Ionicons
            name={result.result.usable ? "checkmark-circle" : "close-circle"}
            size={22}
            color={result.result.usable ? "#22c55e" : "#ef4444"}
          />
          <Text style={[resultStyles.usabilityText, { color: result.result.usable ? "#22c55e" : "#ef4444" }]}>
            {result.result.usable ? "Vaccine is USABLE" : "DO NOT USE — Discard"}
          </Text>
        </View>

        <ResultField label="Confidence" value={`${(result.result.confidence * 100).toFixed(1)}%`} />
        <ResultField label="Model Version" value={result.model_version} />

        <TouchableOpacity style={resultStyles.primaryButton} onPress={onClose}>
          <Text style={resultStyles.primaryButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function EquipmentResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: EquipmentInspectionResponse | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const isOk = result.result.status.toLowerCase().includes("ok") ||
    result.result.status.toLowerCase().includes("normal") ||
    result.result.status.toLowerCase().includes("good");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={resultStyles.container}>
        <View style={resultStyles.header}>
          <Text style={resultStyles.title}>Equipment Inspection</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={[resultStyles.statusBadge, isOk ? resultStyles.validBadge : resultStyles.unusableBadge]}>
          <Ionicons
            name={isOk ? "checkmark-circle" : "warning"}
            size={20}
            color={isOk ? "#22c55e" : "#f97316"}
          />
          <Text style={[resultStyles.statusText, { color: isOk ? "#22c55e" : "#f97316" }]}>
            {result.result.status}
          </Text>
        </View>

        <View style={resultStyles.detailsBox}>
          <Text style={resultStyles.detailsLabel}>Inspection Details</Text>
          <Text style={resultStyles.detailsText}>{result.result.details}</Text>
        </View>

        <ResultField label="Model Version" value={result.model_version} />

        <TouchableOpacity style={resultStyles.primaryButton} onPress={onClose}>
          <Text style={resultStyles.primaryButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function ResultField({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={resultStyles.field}>
      <Text style={resultStyles.fieldLabel}>{label}</Text>
      <Text style={[resultStyles.fieldValue, mono && resultStyles.mono, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

function ModeButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color={active ? "#fff" : "#94a3b8"} />
      <Text style={[styles.modeBtnLabel, active && styles.modeBtnLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32, backgroundColor: "#f8fafc" },
  permTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  permSubtitle: { fontSize: 14, color: "#64748b", textAlign: "center" },
  permButton: { backgroundColor: "#0ea5e9", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  modeBar: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#0f172a",
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  modeBtnActive: { backgroundColor: "#0ea5e9" },
  modeBtnLabel: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
  modeBtnLabelActive: { color: "#fff" },
  cameraContainer: { flex: 1, position: "relative" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  topOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  middleRow: { flexDirection: "row", height: 240 },
  sideOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#0ea5e9",
    borderRadius: 12,
    overflow: "hidden",
  },
  scanFrameCircle: { borderRadius: 120 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  processingText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  bottomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
  },
  hintText: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#fecaca",
  },
  errorText: { flex: 1, fontSize: 13, color: "#ef4444" },
});

const resultStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  validBadge: { backgroundColor: "#f0fdf4" },
  unknownBadge: { backgroundColor: "#f8fafc" },
  unusableBadge: { backgroundColor: "#fef2f2" },
  statusText: { fontSize: 15, fontWeight: "600" },
  vvmStage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  stageIndicator: { width: 48, height: 48, borderRadius: 10 },
  stageInfo: { flex: 1 },
  stageLabel: { fontSize: 18, fontWeight: "700" },
  stageDescription: { fontSize: 13, color: "#64748b", marginTop: 2 },
  usabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  usableBadge: { backgroundColor: "#f0fdf4" },
  usabilityText: { fontSize: 16, fontWeight: "700" },
  field: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  fieldLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "500", marginBottom: 3 },
  fieldValue: { fontSize: 15, color: "#0f172a" },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13 },
  detailsBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailsLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "500", marginBottom: 6 },
  detailsText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  primaryButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  fields: { flex: 1 },
});
