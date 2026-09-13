export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_state: {
        Row: {
          challenges: string[]
          chat: Json
          created_at: string
          device_id: string
          supplement_routine: string[]
          updated_at: string
        }
        Insert: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id: string
          supplement_routine?: string[]
          updated_at?: string
        }
        Update: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id?: string
          supplement_routine?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          created_at: string
          date: string
          device_id: string
          meals: number
          updated_at: string
          water_ml: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          meals?: number
          updated_at?: string
          water_ml?: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          meals?: number
          updated_at?: string
          water_ml?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          created_at: string
          days_per_week: number
          device_id: string
          equipment: string
          goal: string
          height_cm: number
          level: string
          name: string
          restrictions: string[]
          updated_at: string
          weight_kg: number
        }
        Insert: {
          age?: number
          created_at?: string
          days_per_week?: number
          device_id: string
          equipment?: string
          goal?: string
          height_cm?: number
          level?: string
          name?: string
          restrictions?: string[]
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          age?: number
          created_at?: string
          days_per_week?: number
          device_id?: string
          equipment?: string
          goal?: string
          height_cm?: number
          level?: string
          name?: string
          restrictions?: string[]
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          client_id: string
          created_at: string
          date: string
          day_id: string
          device_id: string
          duration_min: number
          exercises: Json
          id: string
          title: string
          updated_at: string
          volume_kg: number
        }
        Insert: {
          client_id: string
          created_at?: string
          date?: string
          day_id?: string
          device_id: string
          duration_min?: number
          exercises?: Json
          id?: string
          title?: string
          updated_at?: string
          volume_kg?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          day_id?: string
          device_id?: string
          duration_min?: number
          exercises?: Json
          id?: string
          title?: string
          updated_at?: string
          volume_kg?: number
        }
        Relationships: []
      }
      supplement_logs: {
        Row: {
          created_at: string
          date: string
          device_id: string
          supplement_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          supplement_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          supplement_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      weights: {
        Row: {
          created_at: string
          date: string
          device_id: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
