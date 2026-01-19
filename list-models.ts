import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function listGoogleModels() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!key) {
    console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local");
    return;
  }

  console.log("🔍 Fetching available Google models...");
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log("✅ Available models:");
    console.log("===================");
    
    if (data.models && Array.isArray(data.models)) {
      data.models.forEach((model: any) => {
        console.log(`📋 ${model.name}`);
        if (model.displayName) {
          console.log(`   Display Name: ${model.displayName}`);
        }
        if (model.description) {
          console.log(`   Description: ${model.description}`);
        }
        if (model.supportedGenerationMethods) {
          console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log("No models found in response");
      console.log("Full response:", JSON.stringify(data, null, 2));
    }
    
  } catch (error: any) {
    console.error("❌ Failed to fetch models:", error.message);
  }
}

listGoogleModels();