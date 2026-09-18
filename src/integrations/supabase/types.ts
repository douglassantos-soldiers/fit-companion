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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          device_id: string
          display_name: string
          id: string
          kind: string
          kudos_count: number
          payload: Json
        }
        Insert: {
          created_at?: string
          device_id: string
          display_name?: string
          id?: string
          kind: string
          kudos_count?: number
          payload?: Json
        }
        Update: {
          created_at?: string
          device_id?: string
          display_name?: string
          id?: string
          kind?: string
          kudos_count?: number
          payload?: Json
        }
        Relationships: []
      }
      activity_kudos: {
        Row: {
          created_at: string
          device_id: string
          event_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          event_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_kudos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      app_entitlements: {
        Row: {
          access_tier: string | null
          device_id: string
          email: string
          granted_at: string
          last_synced_at: string | null
          order_count: number | null
          product_ids: string[] | null
          shopify_customer_id: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          access_tier?: string | null
          device_id: string
          email: string
          granted_at?: string
          last_synced_at?: string | null
          order_count?: number | null
          product_ids?: string[] | null
          shopify_customer_id?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          access_tier?: string | null
          device_id?: string
          email?: string
          granted_at?: string
          last_synced_at?: string | null
          order_count?: number | null
          product_ids?: string[] | null
          shopify_customer_id?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_entitlement_emails: {
        Row: {
          access_tier: string | null
          created_at: string
          email: string
          last_order_at: string | null
          magic_expires_at: string | null
          magic_token_hash: string | null
          order_snapshot: Json | null
          product_ids: string[] | null
          shopify_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_tier?: string | null
          created_at?: string
          email: string
          last_order_at?: string | null
          magic_expires_at?: string | null
          magic_token_hash?: string | null
          order_snapshot?: Json | null
          product_ids?: string[] | null
          shopify_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_tier?: string | null
          created_at?: string
          email?: string
          last_order_at?: string | null
          magic_expires_at?: string | null
          magic_token_hash?: string | null
          order_snapshot?: Json | null
          product_ids?: string[] | null
          shopify_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_state: {
        Row: {
          challenges: string[]
          chat: Json
          created_at: string
          device_id: string
          retention: Json
          supplement_routine: string[]
          updated_at: string
        }
        Insert: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
        }
        Update: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id?: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      challenge_entries: {
        Row: {
          challenge_id: string
          device_id: string
          joined_at: string
        }
        Insert: {
          challenge_id: string
          device_id: string
          joined_at?: string
        }
        Update: {
          challenge_id?: string
          device_id?: string
          joined_at?: string
        }
        Relationships: []
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          device_id: string
          updated_at: string
          value: number
        }
        Insert: {
          challenge_id: string
          device_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          challenge_id?: string
          device_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      club_league_weeks: {
        Row: {
          club_id: string
          device_id: string
          points: number
          updated_at: string
          week_start: string
        }
        Insert: {
          club_id: string
          device_id: string
          points?: number
          updated_at?: string
          week_start: string
        }
        Update: {
          club_id?: string
          device_id?: string
          points?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_league_weeks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          device_id: string
          joined_at: string
        }
        Insert: {
          club_id: string
          device_id: string
          joined_at?: string
        }
        Update: {
          club_id?: string
          device_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_stories: {
        Row: {
          club_id: string
          created_at: string
          device_id: string
          id: string
          image_url: string
        }
        Insert: {
          club_id: string
          created_at?: string
          device_id: string
          id?: string
          image_url: string
        }
        Update: {
          club_id?: string
          created_at?: string
          device_id?: string
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_stories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          code: string
          created_at: string
          created_by_device_id: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_device_id: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_device_id?: string
          id?: string
          name?: string
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
      engagement_events: {
        Row: {
          created_at: string
          device_id: string
          id: string
          name: string
          props: Json
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          name: string
          props?: Json
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          name?: string
          props?: Json
        }
        Relationships: []
      }
      friend_quests: {
        Row: {
          club_id: string
          created_at: string
          device_a: string
          device_b: string
          id: string
          progress_a: number
          progress_b: number
          target: number
          week_start: string
        }
        Insert: {
          club_id: string
          created_at?: string
          device_a: string
          device_b: string
          id?: string
          progress_a?: number
          progress_b?: number
          target?: number
          week_start: string
        }
        Update: {
          club_id?: string
          created_at?: string
          device_a?: string
          device_b?: string
          id?: string
          progress_a?: number
          progress_b?: number
          target?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_quests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
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
      social_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          device_id: string
          display_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          device_id: string
          display_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          device_id?: string
          display_name?: string
          updated_at?: string
          user_id?: string | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
