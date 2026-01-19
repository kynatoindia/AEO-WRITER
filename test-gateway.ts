import { generateAIText } from './src/lib/ai/gateway';
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testGateway() {
  console.log("🚀 Testing AI Gateway with corrected model names...");
  
  try {
    console.log("📝 Testing basic text generation...");
    const result = await generateAIText(
      "Say hello in a friendly way",
      "content",
      "test-user"
    );
    
    console.log("✅ SUCCESS!");
    console.log(`Model used: ${result.model}`);
    console.log(`Input tokens: ${result.inputTokens}`);
    console.log(`Output tokens: ${result.outputTokens}`);
    console.log(`Cost: $${result.cost.toFixed(4)}`);
    console.log(`Response: ${result.text}`);
    
  } catch (error: any) {
    console.error("❌ Gateway test failed:");
    console.error("Error message:", error.message);
    
    // Check if it's still a quota issue
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      console.log("\n💡 This is a quota/rate limit issue, not a model name issue.");
      console.log("The gateway is working correctly, you just need to wait or upgrade your plan.");
    } else if (error.message.includes('not found')) {
      console.log("\n💡 Still a model name issue. Let me check what model is being used...");
    } else {
      console.log("\n💡 Different error. Full details:");
      console.error(error);
    }
  }
}

testGateway();