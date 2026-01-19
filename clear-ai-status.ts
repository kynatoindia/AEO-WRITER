import { redis } from './src/lib/redis/client';
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function clearAIStatus() {
  console.log("🧹 Clearing AI provider status from Redis...");
  
  try {
    // Clear Google provider status
    await redis.del('ai:google:status');
    console.log("✅ Cleared ai:google:status");
    
    // Clear OpenAI provider status  
    await redis.del('ai:openai:status');
    console.log("✅ Cleared ai:openai:status");
    
    // Clear any other AI-related cache keys
    const keys = await redis.keys('ai:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Cleared ${keys.length} additional AI cache keys`);
    }
    
    console.log("🎉 All AI provider status cleared! Your gateway should now work properly.");
    
  } catch (error) {
    console.error("❌ Error clearing AI status:", error);
  } finally {
    process.exit(0);
  }
}

clearAIStatus();