const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runDemo() {
    console.log(" [SYSTEM] Node-cron scheduler initialized. Polling WAQI/Weather API...");
    await delay(2000);
    
    console.log("⏱ [17:30] API Check: Index 145 (Moderate). Zone: Vijayawada. Status: Normal.");
    await delay(2000);
    
    console.log("⏱ [17:45] API Check: Index 160 (Moderate). Zone: Vijayawada. Status: Normal.");
    await delay(2000);
    
    console.log("⏱  [18:00] API Check: Index 175 (Warning). Zone: Vijayawada. Status: Monitor.");
    await delay(2500); // Dramatic pause for the video
    
    // The RED Alert!
    console.log("\x1b[31m%s\x1b[0m", " [18:15] CRITICAL ALERT: API safety threshold breached!");
    console.log("\x1b[31m%s\x1b[0m", "⚠️  Vijayawada (Zone 4): SEVERE DISRUPTION DETECTED (Index: 380).");
    await delay(1500);
    
    console.log("⚙️  [SYSTEM] Disruption confirmed. Locating active policies in Vijayawada...");
    await delay(1000);
    
    console.log(" [TELEMETRY] Initiating Zero-Trust Validation for Worker ID: ZOM-8492 (Ravi)...");
    console.log(" Routing kinematic data to Isolation Forest ML Engine...");
}

runDemo();