/**
 * Barcode / QR scanning utilities for VaxAI Vision.
 *
 * Supports GS1 DataMatrix format used on vaccine vials (GS1-128 / GS1 DataMatrix).
 * Application Identifiers (AIs) parsed:
 *   01  — GTIN (14-digit Global Trade Item Number)
 *   10  — Lot / batch number
 *   17  — Expiry date (YYMMDD)
 *   21  — Serial number
 *   240 — Additional product identification
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedVaccineBarcode {
  /** GTIN-14 (Application Identifier 01) */
  gtin: string | null;
  /** Lot / batch number (AI 10) */
  lotNumber: string | null;
  /** Expiry date as ISO string (AI 17: YYMMDD) */
  expiryDate: string | null;
  /** Serial number (AI 21) */
  serialNumber: string | null;
  /** Additional product ID (AI 240) */
  productId: string | null;
  /** Raw scanned value */
  raw: string;
  /** Whether this looks like a valid GS1 vaccine barcode */
  isValid: boolean;
}

export interface BarcodeType {
  type: "gs1" | "qr" | "code128" | "code39" | "unknown";
  raw: string;
}

// ── GS1 Application Identifier parser ────────────────────────────────────────

/**
 * GS1 Application Identifier definitions.
 * Fixed-length AIs have a known length; variable-length AIs use FNC1 (0x1D) as delimiter.
 */
const AI_DEFINITIONS: Record<string, { name: string; fixedLength?: number }> = {
  "00": { name: "sscc", fixedLength: 18 },
  "01": { name: "gtin", fixedLength: 14 },
  "10": { name: "lotNumber" },
  "11": { name: "productionDate", fixedLength: 6 },
  "13": { name: "packagingDate", fixedLength: 6 },
  "15": { name: "bestBefore", fixedLength: 6 },
  "17": { name: "expiryDate", fixedLength: 6 },
  "21": { name: "serialNumber" },
  "240": { name: "productId" },
  "241": { name: "customerId" },
  "310": { name: "netWeightKg", fixedLength: 6 },
};

const FNC1 = "\x1d"; // GS1 FNC1 separator

/**
 * Parse a raw GS1 DataMatrix / GS1-128 string into structured fields.
 * Handles both FNC1-delimited and positional formats.
 */
export function parseGS1Barcode(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  const data = raw.replace(/^\]d2/, ""); // Strip GS1 DataMatrix symbology identifier

  while (i < data.length) {
    // Try 3-digit AI first, then 2-digit
    let ai: string | undefined;
    let aiDef: (typeof AI_DEFINITIONS)[string] | undefined;

    const threeDigit = data.slice(i, i + 3);
    if (AI_DEFINITIONS[threeDigit]) {
      ai = threeDigit;
      aiDef = AI_DEFINITIONS[threeDigit];
    } else {
      const twoDigit = data.slice(i, i + 2);
      if (AI_DEFINITIONS[twoDigit]) {
        ai = twoDigit;
        aiDef = AI_DEFINITIONS[twoDigit];
      }
    }

    if (!ai || !aiDef) {
      // Skip unknown character and keep scanning
      i++;
      continue;
    }

    i += ai.length;

    let value: string;
    if (aiDef.fixedLength !== undefined) {
      value = data.slice(i, i + aiDef.fixedLength);
      i += aiDef.fixedLength;
    } else {
      // Variable-length: read until FNC1 or end of string
      const fnc1Pos = data.indexOf(FNC1, i);
      if (fnc1Pos === -1) {
        value = data.slice(i);
        i = data.length;
      } else {
        value = data.slice(i, fnc1Pos);
        i = fnc1Pos + 1;
      }
    }

    result[aiDef.name] = value;
  }

  return result;
}

// ── Expiry date formatting ────────────────────────────────────────────────────

/**
 * Convert GS1 expiry date (YYMMDD) to ISO 8601 string.
 * GS1 spec: year 00-49 = 2000-2049, year 50-99 = 1950-1999.
 * Day 00 = last day of the month.
 */
export function parseGS1ExpiryDate(yymmdd: string): string | null {
  if (yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  let dd = parseInt(yymmdd.slice(4, 6), 10);

  const year = yy <= 49 ? 2000 + yy : 1900 + yy;

  if (dd === 0) {
    // Last day of month
    dd = new Date(year, mm, 0).getDate();
  }

  const month = String(mm).padStart(2, "0");
  const day = String(dd).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Main parse function ───────────────────────────────────────────────────────

/**
 * Parse a barcode string into a structured vaccine vial representation.
 * Handles GS1 DataMatrix, QR codes with GS1 data, and plain lot-number barcodes.
 */
export function parseVaccineBarcode(raw: string): ParsedVaccineBarcode {
  const result: ParsedVaccineBarcode = {
    gtin: null,
    lotNumber: null,
    expiryDate: null,
    serialNumber: null,
    productId: null,
    raw,
    isValid: false,
  };

  if (!raw || raw.trim().length === 0) return result;

  // Attempt GS1 parse
  const gs1 = parseGS1Barcode(raw);

  result.gtin = gs1.gtin ?? null;
  result.lotNumber = gs1.lotNumber ?? null;
  result.serialNumber = gs1.serialNumber ?? null;
  result.productId = gs1.productId ?? null;

  if (gs1.expiryDate) {
    result.expiryDate = parseGS1ExpiryDate(gs1.expiryDate);
  } else if (gs1.bestBefore) {
    result.expiryDate = parseGS1ExpiryDate(gs1.bestBefore);
  }

  // A barcode is considered valid if it has at least a GTIN or lot number
  result.isValid = Boolean(result.gtin || result.lotNumber);

  return result;
}

// ── Barcode type detection ────────────────────────────────────────────────────

/**
 * Attempt to identify the type of barcode from the raw value.
 */
export function detectBarcodeType(raw: string): BarcodeType {
  if (!raw) return { type: "unknown", raw };

  // GS1 DataMatrix starts with ]d2 symbology identifier or contains AI patterns
  if (raw.startsWith("]d2") || /^\(01\)/.test(raw)) {
    return { type: "gs1", raw };
  }

  // Check for AI patterns (01), (10), (17), (21)
  if (/\(0[12]\)/.test(raw) || /\(1[07]\)/.test(raw) || /\(21\)/.test(raw)) {
    return { type: "gs1", raw };
  }

  // Numeric-only 14-digit = GTIN
  if (/^\d{14}$/.test(raw)) {
    return { type: "gs1", raw };
  }

  // QR codes often contain URLs or JSON
  if (raw.startsWith("http") || raw.startsWith("{")) {
    return { type: "qr", raw };
  }

  // Code 128: typically alphanumeric
  if (/^[A-Z0-9\-. $/+%]{6,}$/.test(raw)) {
    return { type: "code128", raw };
  }

  // Code 39: uppercase alpha + digits + special chars
  if (/^[A-Z0-9 $%+\-./]{1,}$/.test(raw)) {
    return { type: "code39", raw };
  }

  return { type: "unknown", raw };
}

// ── GTIN validation ───────────────────────────────────────────────────────────

/**
 * Validate a GTIN using the GS1 check digit algorithm (mod-10).
 * Works for GTIN-8, GTIN-12, GTIN-13, GTIN-14.
 */
export function isValidGTIN(gtin: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(gtin)) return false;

  const digits = gtin.split("").map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

// ── Expiry helpers ────────────────────────────────────────────────────────────

export function isExpired(expiryDateIso: string): boolean {
  return new Date(expiryDateIso) < new Date();
}

export function daysUntilExpiry(expiryDateIso: string): number {
  const diff = new Date(expiryDateIso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
