import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";

import RemoteMouseApp from "./RemoteMouseApp";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return <RemoteMouseApp />;
}
