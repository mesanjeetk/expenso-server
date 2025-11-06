import "dotenv/config";
import express from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import {xss} from "express-xss-sanitizer";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";

const app = express();
app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP"
});

app.use("/api", limiter);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};


function colorStatus(status) {
  if (status >= 500) return colors.red + status + colors.reset;
  if (status >= 400) return colors.yellow + status + colors.reset;
  if (status >= 300) return colors.cyan + status + colors.reset;
  if (status >= 200) return colors.green + status + colors.reset;
  return colors.white + status + colors.reset;
}


app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toLocaleString();
    const ip = req.ip || req.connection.remoteAddress;

    const method = `${colors.magenta}${req.method}${colors.reset}`;
    const url = `${colors.blue}${req.originalUrl}${colors.reset}`;
    const status = colorStatus(res.statusCode);
    const time = `${colors.dim}${duration}ms${colors.reset}`;

    console.log(
      `${colors.bright}[${timestamp}]${colors.reset} ${ip} - ${method} ${url} → ${status} (${time})`
    );
  });

  next();
});

app.get("/", (req, res) => {
    res.send("Welcome to Expenzo API");
});

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import transactionRoutes from "./routes/transaction.route.js";


app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/transaction", transactionRoutes)

export { app };