// final-check.js (Hakikisha neno gemini-1.5-flash liko hivi)
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
    // COPY-PASTE KEY YAKO HAPA KWA UMAKINI
    const genAI = new GoogleGenerativeAI("AIzaSyBE_O6kcPjOSEY0WS-r3ZIDmMozx0EZg40"); 
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Habari mwalimu!");
        console.log("✅ JIBU:", result.response.text());
    } catch (error) {
        console.error("❌ SHIDA IKO HAPA:", error.message);
    }
}
run();