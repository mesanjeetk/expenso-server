import cors from "cors";
import express from "express";

const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.send("Welcome to Expenzo API");
});
    

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";


app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)

export { app };