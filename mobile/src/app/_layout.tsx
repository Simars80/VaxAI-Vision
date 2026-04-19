import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/store/auth";
import { useSyncStore } from "@/store/sync";
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  removeSubscription,
} from "@/lib/notifications";

// Keep the splash screen visible until we've finished loading
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { init: initAuth } = useAuthStore();
  const { init: initSync } = useSyncStore();

  useEffect(() => {
    let notifReceivedSub: Notifications.Subscription;
    let notifResponseSub: Notifications.Subscription;

    async function bootstrap() {
      // Restore auth session from SecureStore
      await initAuth();

      // Hide splash screen
      await SplashScreen.hideAsync();

      // Set up push notifications
      await registerForPushNotifications();

      // Listen for incoming notifications
      notifReceivedSub = addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification.request.content.title);
      });

      // Handle taps on notifications
      notifResponseSub = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data?.type);
        // TODO: navigate based on data.type (e.g. to cold-chain tab)
      });
    }

    // Initialize network/sync listener
    const unsubscribeSync = initSync();

    bootstrap();

    return () => {
      if (notifReceivedSub) removeSubscription(notifReceivedSub);
      if (notifResponseSub) removeSubscription(notifResponseSub);
      unsubscribeSync();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
