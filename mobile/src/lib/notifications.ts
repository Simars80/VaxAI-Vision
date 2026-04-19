import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Notification handler (how to display while foregrounded) ──────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PUSH_TOKEN_KEY = "vaxai_push_token";

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Request permission and retrieve the Expo push token.
 * On Android, sets up a notification channel first.
 * Returns null if permission denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  // Android channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("vaxai-alerts", {
      name: "VaxAI Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0ea5e9",
    });
    await Notifications.setNotificationChannelAsync("vaxai-coldchain", {
      name: "Cold Chain Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#ef4444",
    });
    await Notifications.setNotificationChannelAsync("vaxai-stockout", {
      name: "Stock Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
    });
  }

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("Push notification permission not granted");
    return null;
  }

  // Get Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // Cache locally
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  return token;
}

export async function getCachedPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

// ── Local alert scheduling ────────────────────────────────────────────────────

export interface StockoutAlertPayload {
  vaccineName: string;
  facilityName: string;
  currentStock: number;
  unit: string;
}

/** Schedule a local notification for a stockout alert */
export async function scheduleStockoutAlert(payload: StockoutAlertPayload): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Low Stock Alert",
      body: `${payload.vaccineName} at ${payload.facilityName}: only ${payload.currentStock} ${payload.unit} remaining`,
      data: { type: "stockout", ...payload },
      sound: true,
      categoryIdentifier: "vaxai-stockout",
    },
    trigger: null, // Fire immediately
  });
  return id;
}

export interface ColdChainAlertPayload {
  facilityName: string;
  sensorId: string;
  temperature: number;
  threshold: number;
  alertType: "high" | "low";
}

/** Schedule a local notification for a cold chain temperature breach */
export async function scheduleColdChainAlert(payload: ColdChainAlertPayload): Promise<string> {
  const direction = payload.alertType === "high" ? "above" : "below";
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Cold Chain Breach",
      body: `${payload.facilityName} — sensor ${payload.sensorId} is ${direction} threshold (${payload.temperature.toFixed(1)}°C vs ${payload.threshold}°C)`,
      data: { type: "cold_chain", ...payload },
      sound: true,
      categoryIdentifier: "vaxai-coldchain",
    },
    trigger: null,
  });
  return id;
}

/** Schedule a recurring daily sync reminder if offline data may be stale */
export async function scheduleDailySyncReminder(): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "VaxAI Vision",
      body: "You have unsynced data. Connect to the internet to sync.",
      data: { type: "sync_reminder" },
    },
    trigger: {
      hour: 8,
      minute: 0,
      repeats: true,
    } as Notifications.CalendarTriggerInput,
  });
  return id;
}

// ── Notification listeners ────────────────────────────────────────────────────

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function removeSubscription(subscription: Notifications.Subscription): void {
  Notifications.removeNotificationSubscription(subscription);
}

/** Cancel all pending notifications */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
