# VaxAI Vision — Mobile App

React Native (Expo SDK 51) mobile app for the VaxAI Vision vaccine supply chain platform.

## Features

- **Dashboard** — KPI overview, active cold chain alerts, critical stock summary
- **Inventory** — Browse stock levels by facility, filter by status, record adjustments
- **Cold Chain** — Monitor temperature readings and alerts, resolve breaches
- **Scan** — Three modes:
  - Barcode scanner (GS1 DataMatrix, QR, Code128, Code39) — extracts GTIN, lot, expiry, serial
  - VVM (Vaccine Vial Monitor) — AI-powered stage classification via camera capture
  - Equipment inspection — AI analysis of cold chain equipment photos
- **Offline-first** — All data cached in AsyncStorage, mutations queued when offline
- **Push notifications** — Stockout alerts and cold chain breach notifications
- **Auto-sync** — Queue flushes automatically when connectivity returns

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 15+ and an Apple Developer account (for device testing)
- Android: Android Studio with an emulator or physical device
- Expo Go app on your phone (for quick development)

## Setup

```bash
cd mobile
npm install
```

### Environment variables

Copy the example env file and fill in your backend URL:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_API_URL=https://api.vaxaivision.com/api/v1
```

For local development against the backend:

```
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Running

### Expo Go (fastest — no build needed)

```bash
npm start
# Scan the QR code with Expo Go on iOS or Android
```

### iOS Simulator

```bash
npm run ios
```

### Android Emulator

```bash
npm run android
```

### Web (limited — camera/notifications not available)

```bash
npm run web
```

## Project Structure

```
mobile/
├── app.json                  # Expo config
├── package.json
├── tsconfig.json
└── src/
    ├── api/                  # API client + typed endpoint functions
    │   ├── client.ts         # Axios instance, token management, offline queue
    │   ├── auth.ts
    │   ├── inventory.ts
    │   ├── coldchain.ts
    │   └── vision.ts
    ├── store/                # Zustand state management
    │   ├── auth.ts           # Auth state with SecureStore persistence
    │   ├── inventory.ts      # Inventory with AsyncStorage cache
    │   └── sync.ts           # Network status + offline queue sync
    ├── app/                  # expo-router file-based routes
    │   ├── _layout.tsx       # Root layout (auth init, notifications, sync)
    │   ├── index.tsx         # Auth redirect
    │   ├── (auth)/
    │   │   └── login.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx   # Tab navigator
    │       ├── dashboard.tsx
    │       ├── inventory.tsx
    │       ├── cold-chain.tsx
    │       └── scan.tsx
    ├── components/
    │   ├── OfflineBanner.tsx  # Animated offline indicator
    │   ├── SyncStatus.tsx     # Header sync icon + queue count
    │   ├── AlertCard.tsx      # Cold chain alert display
    │   ├── StockCard.tsx      # Inventory item card
    │   └── TemperatureGauge.tsx # Temperature range visualization
    └── lib/
        ├── notifications.ts  # Expo notifications setup + scheduling
        ├── offline.ts        # AsyncStorage cache layer with TTL
        └── barcode.ts        # GS1 DataMatrix barcode parser
```

## Key Architecture Decisions

### Offline-First

The app is designed to work in low-connectivity environments (rural clinics, field deployments):

1. All GET responses are cached in `AsyncStorage` with configurable TTL (default 15 min)
2. Failed mutations (POST/PUT/PATCH/DELETE) are queued in `AsyncStorage` via `src/api/client.ts`
3. `useSyncStore` monitors network state via `@react-native-community/netinfo`
4. When connectivity returns, the queue is flushed automatically
5. Stale cached data is shown as a fallback when the network is unavailable

### Secure Token Storage

Auth tokens are stored in `expo-secure-store` (iOS Keychain / Android Keystore) — not AsyncStorage.

### Camera Permissions

Barcode scanning uses `expo-camera`'s built-in `onBarcodeScanned` callback (no separate library needed).
VVM and equipment inspection use `expo-image-picker` to capture a JPEG and POST it to the backend.

### GS1 Barcode Parsing

`src/lib/barcode.ts` implements a full GS1 Application Identifier parser supporting:
- GTIN-14 (AI 01)
- Lot/batch number (AI 10)
- Expiry date (AI 17, YYMMDD)
- Serial number (AI 21)
- FNC1-delimited variable-length fields

## Building for Production

### EAS Build (recommended)

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

### OTA Updates

```bash
eas update --branch production --message "Fix cold chain alert rendering"
```

## Adding Assets

Place app icons and splash screens in `mobile/assets/`:
- `icon.png` — 1024x1024 app icon
- `splash.png` — 1284x2778 splash screen
- `adaptive-icon.png` — 1024x1024 Android adaptive icon foreground
- `notification-icon.png` — 96x96 Android notification icon (monochrome)

## Type Checking

```bash
npm run type-check
```

## Contributing

Follow the project-wide contribution guidelines in `CONTRIBUTING.md` at the repository root.
All changes should go through a feature branch and PR — see `PR_TEMPLATE.md`.
