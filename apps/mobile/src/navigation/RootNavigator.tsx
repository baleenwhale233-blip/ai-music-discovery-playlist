import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { HomeScreen } from "../features/home/screens/HomeScreen";
import { LibraryScreen } from "../features/library/screens/LibraryScreen";
import { RecentScreen } from "../features/recent/screens/RecentScreen";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";

type RootStackParamList = {
  Tabs: undefined;
};

type RootTabParamList = {
  Home: undefined;
  Library: undefined;
  Recent: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "发现" }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: "歌单" }} />
      <Tab.Screen name="Recent" component={RecentScreen} options={{ title: "最近" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "我的" }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
