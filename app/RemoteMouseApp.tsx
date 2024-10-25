import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  Vibration,
  GestureResponderEvent,
} from "react-native";

const { width } = Dimensions.get("window");
const BASE_SENSITIVITY = 1.5;

interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface MouseDelta {
  deltaX: number;
  deltaY: number;
}

const RemoteMouseApp: React.FC = () => {
  const [serverIP, setServerIP] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string>("");
  const [sensitivity, setSensitivity] = useState<number>(BASE_SENSITIVITY);

  const touchStart = useRef<TouchPosition | null>(null);
  const lastTouch = useRef<TouchPosition | null>(null);
  const isTracking = useRef<boolean>(false);

  const makeRequest = useCallback(
    async (endpoint: string, method: "GET" | "POST" = "GET", body?: object) => {
      try {
        const response = await fetch(`http://${serverIP}:3000/${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Request error (${endpoint}):`, errorMessage);
        return { success: false, message: errorMessage };
      }
    },
    [serverIP]
  );

  const calculateMouseDelta = (event: GestureResponderEvent): MouseDelta => {
    const { locationX, locationY } = event.nativeEvent;
    const currentTime = Date.now();

    if (!lastTouch.current) {
      lastTouch.current = {
        x: locationX,
        y: locationY,
        timestamp: currentTime,
      };
      return { deltaX: 0, deltaY: 0 };
    }

    const deltaX = locationX - lastTouch.current.x;
    const deltaY = locationY - lastTouch.current.y;
    const deltaTime = currentTime - lastTouch.current.timestamp;

    lastTouch.current = { x: locationX, y: locationY, timestamp: currentTime };

    if (deltaTime === 0) return { deltaX: 0, deltaY: 0 };

    const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;
    const speedMultiplier = Math.min(Math.max(speed * 10, 0.5), 2.0);

    return {
      deltaX: deltaX * sensitivity * speedMultiplier,
      deltaY: deltaY * sensitivity * speedMultiplier,
    };
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const timestamp = Date.now();
    touchStart.current = { x: locationX, y: locationY, timestamp };
    lastTouch.current = { x: locationX, y: locationY, timestamp };
    isTracking.current = true;
  };

  const handleTouchMove = useCallback(
    async (event: GestureResponderEvent) => {
      if (!isTracking.current || !connected) return;

      const { deltaX, deltaY } = calculateMouseDelta(event);

      if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
        const result = await makeRequest("mouse", "POST", { deltaX, deltaY });
        if (!result.success) {
          setConnected(false);
          Alert.alert("Connection Lost", "Lost connection to server");
        }
      }
    },
    [connected, makeRequest, sensitivity]
  );

  const handleTouchEnd = () => {
    isTracking.current = false;
    touchStart.current = null;
    lastTouch.current = null;
  };

  const adjustSensitivity = (increase: boolean) => {
    setSensitivity((prev) => {
      const newValue = increase ? prev * 1.2 : prev / 1.2;
      Vibration.vibrate(100);
      return Math.max(0.5, Math.min(5, newValue));
    });
  };

  const connectToServer = async () => {
    if (!serverIP.trim()) {
      Alert.alert("Error", "Please enter a server IP address");
      return;
    }

    const result = await makeRequest("test");

    if (result.success) {
      setConnected(true);
      setLastError("");
      Vibration.vibrate(100);
      Alert.alert("Success", "Connected to server successfully!");
    } else {
      setConnected(false);
      setLastError(result.message || "Failed to connect");
      Alert.alert("Error", `Connection failed: ${result.message}`);
    }
  };

  const handleClick = async (type: "left" | "right") => {
    if (!connected) return;

    Vibration.vibrate(50);
    const result = await makeRequest("click", "POST", { type });

    if (!result.success) {
      setConnected(false);
      Alert.alert("Connection Lost", "Lost connection to server");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Remote Mouse</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter server IP address"
            placeholderTextColor="#666"
            value={serverIP}
            onChangeText={setServerIP}
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.connectButton, connected && styles.connectedButton]}
            onPress={connectToServer}
          >
            <Text style={styles.buttonText}>
              {connected ? "Connected" : "Connect"}
            </Text>
          </TouchableOpacity>
        </View>

        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}

        <View
          style={[styles.touchpad, !connected && styles.touchpadDisabled]}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
        >
          <Text style={styles.touchpadText}>
            {connected ? "Track your finger here" : "Not connected"}
          </Text>
          {connected && (
            <>
              <Text style={styles.touchpadSubText}>
                Sensitivity: {sensitivity.toFixed(1)}x
              </Text>
              <View style={styles.sensitivityControls}>
                <TouchableOpacity
                  style={styles.sensitivityButton}
                  onPress={() => adjustSensitivity(false)}
                >
                  <Text style={styles.sensitivityButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sensitivityButton}
                  onPress={() => adjustSensitivity(true)}
                >
                  <Text style={styles.sensitivityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.clickButton, !connected && styles.buttonDisabled]}
            onPress={() => handleClick("left")}
            disabled={!connected}
          >
            <Text style={styles.buttonText}>Left Click</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.clickButton, !connected && styles.buttonDisabled]}
            onPress={() => handleClick("right")}
            disabled={!connected}
          >
            <Text style={styles.buttonText}>Right Click</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },
  header: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    color: "white",
    fontSize: 16,
    backgroundColor: "#2D2D2D",
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
  },
  connectButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 12,
    minWidth: 100,
  },
  connectedButton: {
    backgroundColor: "#28CD41",
  },
  touchpad: {
    flex: 1,
    backgroundColor: "#2D2D2D",
    margin: 20,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333",
  },
  touchpadDisabled: {
    backgroundColor: "#252525",
    opacity: 0.7,
  },
  touchpadText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  touchpadSubText: {
    color: "#666",
    fontSize: 14,
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  clickButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 15,
    width: width * 0.4,
  },
  buttonDisabled: {
    backgroundColor: "#404040",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  errorText: {
    color: "#FF453A",
    textAlign: "center",
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 16,
  },
  sensitivityControls: {
    flexDirection: "row",
    marginTop: 10,
    gap: 20,
  },
  sensitivityButton: {
    backgroundColor: "#007AFF",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sensitivityButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
});

export default RemoteMouseApp;
