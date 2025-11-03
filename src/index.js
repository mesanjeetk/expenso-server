import "dotenv/config";
import { app } from "./app.js";
import { connectDB } from "./db/index.js";
import os from "os";


function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === "IPv4" && !net.internal) {
                return net.address;
            }
        }
    }
    return "localhost";
}

const PORT = process.env.PORT || 8000;
connectDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        const localIP = getLocalIP();
        console.log(`\n🚀 Server running on:`);
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Network: http://${localIP}:${PORT}\n`);
    })
}).catch(err => {
    console.error("Failed to connect to the database", err);
})