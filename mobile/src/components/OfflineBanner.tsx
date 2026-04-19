import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "@/store/sync";

/**
 * Shows a sticky banner at the top of the screen when offline.
 * Animates in/out smoothly.
 */
export function OfflineBanner() {
  const { status } = useSyncStore();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isOffline = status === "offline";

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  if (!isOffline) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>You are offline — viewing cached data</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#64748b",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
});
