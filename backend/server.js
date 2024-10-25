const express = require("express");
const robot = require("robotjs");
const cors = require("cors");
const morgan = require("morgan");

const config = {
  port: 3000,
  host: "0.0.0.0",
  corsOptions: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
  mouseSettings: {
    maxDelta: 100,
    smoothing: 0.3,
    minMove: 1,
  },
};

const app = express();

app.use(morgan("dev"));
app.use(cors(config.corsOptions));
app.use(express.json());

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

let lastMove = {
  timestamp: 0,
  x: 0,
  y: 0,
};

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const smoothMouseMovement = (deltaX, deltaY) => {
  const currentTime = Date.now();
  const timeDelta = currentTime - lastMove.timestamp;

  if (timeDelta > 100) {
    lastMove = {
      timestamp: currentTime,
      x: deltaX,
      y: deltaY,
    };
    return { x: deltaX, y: deltaY };
  }

  const smoothX =
    deltaX * (1 - config.mouseSettings.smoothing) +
    lastMove.x * config.mouseSettings.smoothing;
  const smoothY =
    deltaY * (1 - config.mouseSettings.smoothing) +
    lastMove.y * config.mouseSettings.smoothing;

  lastMove = {
    timestamp: currentTime,
    x: smoothX,
    y: smoothY,
  };

  return { x: smoothX, y: smoothY };
};

app.get("/test", (req, res) => {
  try {
    const position = robot.getMousePos();
    res.json({
      success: true,
      message: "Server is running and robotjs is operational",
      position,
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize mouse control",
    });
  }
});

app.post("/mouse", (req, res) => {
  try {
    const { deltaX, deltaY } = req.body;

    if (typeof deltaX !== "number" || typeof deltaY !== "number") {
      throw new Error("Invalid mouse movement data");
    }

    const clampedDeltaX = clampValue(
      deltaX,
      -config.mouseSettings.maxDelta,
      config.mouseSettings.maxDelta
    );
    const clampedDeltaY = clampValue(
      deltaY,
      -config.mouseSettings.maxDelta,
      config.mouseSettings.maxDelta
    );

    const currentPos = robot.getMousePos();

    const { x: smoothX, y: smoothY } = smoothMouseMovement(
      clampedDeltaX,
      clampedDeltaY
    );

    const newX = Math.round(currentPos.x + smoothX);
    const newY = Math.round(currentPos.y + smoothY);

    if (
      Math.abs(smoothX) > config.mouseSettings.minMove ||
      Math.abs(smoothY) > config.mouseSettings.minMove
    ) {
      robot.moveMouse(newX, newY);
    }

    res.json({
      success: true,
      position: { x: newX, y: newY },
      delta: { x: smoothX, y: smoothY },
    });
  } catch (error) {
    console.error("Mouse movement error:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/click", (req, res) => {
  try {
    const { type } = req.body;

    if (!["left", "right"].includes(type)) {
      throw new Error("Invalid click type");
    }

    robot.mouseClick(type);

    res.json({
      success: true,
      message: `Performed ${type} click`,
    });
  } catch (error) {
    console.error("Mouse click error:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/position", (req, res) => {
  try {
    const position = robot.getMousePos();
    res.json({
      success: true,
      position,
    });
  } catch (error) {
    console.error("Position retrieval error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get mouse position",
    });
  }
});

app.listen(config.port, config.host, () => {
  console.log(`
🖱️  Remote Mouse Server Running
📍 Host: ${config.host}
🚪 Port: ${config.port}
🌐 URL: http://${config.host}:${config.port}
  `);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Shutting down gracefully...");
  process.exit(0);
});
