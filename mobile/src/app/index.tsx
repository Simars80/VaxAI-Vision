import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";

/**
 * Splash redirect screen.
 * Waits for auth store to initialize, then redirects to either
 * the main tabs or the login screen.
 */
export default function Index() {
  const { isAuthenticated, loading } = useAuthStore();

  // Show a brief loading indicator while auth state is being restored
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
});
