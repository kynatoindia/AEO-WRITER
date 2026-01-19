import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runNakedTest() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!key) {
    console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local");
    return;
  }

  console.log("🚀 Starting NAKED test (Bypassing Gateway)...");
  
  // TEST THIS NAME FIRST
  const modelName = "gemini-2.0-flash";
  
  try {
    const result = await generateText({
      model: google(modelName, { apiKey: key }),
      prompt: "Test message - respond with 'Hello from Gemini!'"
    });
    
    console.log(`✅ SUCCESS! Model '${modelName}' is working.`);
    console.log("Response:", result.text);
  } catch (error: any) {
    console.error(`❌ FAILED! Raw error from Google:`);
    console.error(error.message);
    console.error("Full error:", error);
  }
}

runNakedTest();