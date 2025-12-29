export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      content_sections: {
        Row: {
          id: string
          project_id: string
          section_order: number
          heading: string
          goal: string | null
          sub_sections: Json
          content_elements: string[]
          data_sources: string[]
          generated_content: string | null
          status: Database["public"]["Enums"]["section_status"]
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          section_order: number
          heading: string
          goal?: string | null
          sub_sections?: Json
          content_elements?: string[]
          data_sources?: string[]
          generated_content?: string | null
          status?: Database["public"]["Enums"]["section_status"]
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          section_order?: number
          heading?: string
          goal?: string | null
          sub_sections?: Json
          content_elements?: string[]
          data_sources?: string[]
          generated_content?: string | null
          status?: Database["public"]["Enums"]["section_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          user_id: string
          topic: string
          status: Database["public"]["Enums"]["project_status"]
          competitor_urls: string[]
          tone: Database["public"]["Enums"]["content_tone"]
          format: Database["public"]["Enums"]["content_format"]
          brand_document_path: string | null
          openai_thread_id: string | null
          blueprint: Json | null
          generated_content: string | null
          seo_metadata: Json | null
          token_usage: Json | null
          cost_breakdown: Json | null
          research_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic: string
          status?: Database["public"]["Enums"]["project_status"]
          competitor_urls?: string[]
          tone: Database["public"]["Enums"]["content_tone"]
          format: Database["public"]["Enums"]["content_format"]
          brand_document_path?: string | null
          openai_thread_id?: string | null
          blueprint?: Json | null
          generated_content?: string | null
          seo_metadata?: Json | null
          token_usage?: Json | null
          cost_breakdown?: Json | null
          research_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic?: string
          status?: Database["public"]["Enums"]["project_status"]
          competitor_urls?: string[]
          tone?: Database["public"]["Enums"]["content_tone"]
          format?: Database["public"]["Enums"]["content_format"]
          brand_document_path?: string | null
          openai_thread_id?: string | null
          blueprint?: Json | null
          generated_content?: string | null
          seo_metadata?: Json | null
          token_usage?: Json | null
          cost_breakdown?: Json | null
          research_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_analytics: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          operation_type: string
          tokens_used: number | null
          cost_usd: number | null
          api_provider: string
          model_used: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          operation_type: string
          tokens_used?: number | null
          cost_usd?: number | null
          api_provider: string
          model_used: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          operation_type?: string
          tokens_used?: number | null
          cost_usd?: number | null
          api_provider?: string
          model_used?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_analytics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          subscription_plan: string
          tokens_used: number
          tokens_limit: number
          projects_used: number
          projects_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_plan?: string
          tokens_used?: number
          tokens_limit?: number
          projects_used?: number
          projects_limit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          subscription_plan?: string
          tokens_used?: number
          tokens_limit?: number
          projects_used?: number
          projects_limit?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_project: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      get_project_with_sections: {
        Args: {
          project_uuid: string
        }
        Returns: Json
      }
      increment_user_projects: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      log_usage: {
        Args: {
          user_uuid: string
          project_uuid: string | null
          operation: string
          tokens: number
          cost: number
          provider: string
          model: string
          metadata_json?: Json
        }
        Returns: string
      }
    }
    Enums: {
      content_format: "how-to" | "listicle" | "case-study"
      content_tone: "professional" | "witty" | "data-driven"
      project_status: "draft" | "researching" | "planning" | "writing" | "completed" | "error"
      section_status: "pending" | "writing" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never