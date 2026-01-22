import { createServerSupabaseClient } from './server';
import { createClient } from './client';

// Simple database service focused on authentication
export class DatabaseService {
  // This will be implemented in future tasks
  // For now, we're focusing on authentication only
}

// Client-side database operations (for client components)
export class ClientDatabaseService {
  private supabase = createClient();

  // Auth helpers
  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    return { user, error };
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }
}

// Singleton instances
export const db = new DatabaseService();
export const clientDb = new ClientDatabaseService();