require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is MISSING in .env.local");
    process.exit(1);
}

console.log("✅ OPENAI_API_KEY is found (Length: " + apiKey.length + ")");

const openai = new OpenAI({ apiKey });

async function test() {
    try {
        console.log("Testing API connection...");
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Cheap test
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
        });
        console.log("✅ API Connection SUCCESS: " + response.choices[0].message.content);
    } catch (error) {
        console.error("❌ API Connection FAILED:", error.message);
    }
}

test();
