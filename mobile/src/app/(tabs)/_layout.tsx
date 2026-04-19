import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth";
import { SyncStatus } from "@/components/SyncStatus";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconName;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconName)}
      size={24}
      color={focused ? "#0ea5e9" : "#94a3b8"}
    />
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: "#fff",
          shadowColor: "transparent",
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: "600",
          color: "#0f172a",
        },
        headerRight: () => <SyncStatus />,
        headerLeft: () => null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="grid" focused={focused} />
          ),
          headerRight: () => (
            <>
              <SyncStatus />
              <TouchableOpacity
                onPress={logout}
                style={{ marginRight: 16, marginLeft: 8 }}
              >
                <Ionicons name="log-out-outline" size={22} color="#64748b" />
              </TouchableOpacity>
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarLabel: "Inventory",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="cube" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarLabel: "Scan",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="scan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cold-chain"
        options={{
          title: "Cold Chain",
          tabBarLabel: "Cold Chain",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="thermometer" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
