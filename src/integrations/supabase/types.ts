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
      app_entitlement_emails: {
        Row: {
          access_tier: string
          created_at: string
          email: string
          last_order_at: string | null
          magic_expires_at: string | null
          magic_token_hash: string | null
          order_snapshot: Json
          product_ids: string[]
          shopify_customer_id: string | null
          updated_at: string
        }
        Insert: {
          access_tier?: string
          created_at?: string
          email: string
          last_order_at?: string | null
          magic_expires_at?: string | null
          magic_token_hash?: string | null
          order_snapshot?: Json
          product_ids?: string[]
          shopify_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          access_tier?: string
          created_at?: string
          email?: string
          last_order_at?: string | null
          magic_expires_at?: string | null
          magic_token_hash?: string | null
          order_snapshot?: Json
          product_ids?: string[]
          shopify_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_entitlements: {
        Row: {
          access_tier: string
          device_id: string
          email: string
          granted_at: string
          last_synced_at: string | null
          order_count: number
          product_ids: string[]
          shopify_customer_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          access_tier?: string
          device_id: string
          email: string
          granted_at?: string
          last_synced_at?: string | null
          order_count?: number
          product_ids?: string[]
          shopify_customer_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          access_tier?: string
          device_id?: string
          email?: string
          granted_at?: string
          last_synced_at?: string | null
          order_count?: number
          product_ids?: string[]
          shopify_customer_id?: string | null
          source?: string
          updated_at?: string
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
          user_id: string | null
        }
        Insert: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id?: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          baseline_value: number
          challenge_id: string
          device_id: string
          pct_value: number | null
          updated_at: string
          value: number
        }
        Insert: {
          baseline_value?: number
          challenge_id: string
          device_id: string
          pct_value?: number | null
          updated_at?: string
          value?: number
        }
        Update: {
          baseline_value?: number
          challenge_id?: string
          device_id?: string
          pct_value?: number | null
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
      customer_identities: {
        Row: {
          created_at: string
          external_customer_id: string
          external_email: string | null
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_customer_id: string
          external_email?: string | null
          id?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_customer_id?: string
          external_email?: string | null
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          average_order_value: number | null
          current_goal: string | null
          estimated_ltv: number | null
          estimated_next_purchase: string | null
          favorite_categories: Json
          favorite_products: Json
          first_purchase_at: string | null
          last_purchase_at: string | null
          metrics: Json
          nutrition_adherence: number | null
          performance_level: string | null
          purchase_frequency_days: number | null
          recovery_score: number | null
          restock_estimates: Json
          total_orders: number
          total_spend: number
          training_frequency: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_order_value?: number | null
          current_goal?: string | null
          estimated_ltv?: number | null
          estimated_next_purchase?: string | null
          favorite_categories?: Json
          favorite_products?: Json
          first_purchase_at?: string | null
          last_purchase_at?: string | null
          metrics?: Json
          nutrition_adherence?: number | null
          performance_level?: string | null
          purchase_frequency_days?: number | null
          recovery_score?: number | null
          restock_estimates?: Json
          total_orders?: number
          total_spend?: number
          training_frequency?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_order_value?: number | null
          current_goal?: string | null
          estimated_ltv?: number | null
          estimated_next_purchase?: string | null
          favorite_categories?: Json
          favorite_products?: Json
          first_purchase_at?: string | null
          last_purchase_at?: string | null
          metrics?: Json
          nutrition_adherence?: number | null
          performance_level?: string | null
          purchase_frequency_days?: number | null
          recovery_score?: number | null
          restock_estimates?: Json
          total_orders?: number
          total_spend?: number
          training_frequency?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          created_at: string
          date: string
          device_id: string
          meals: number
          updated_at: string
          user_id: string | null
          water_ml: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          meals?: number
          updated_at?: string
          user_id?: string | null
          water_ml?: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          meals?: number
          updated_at?: string
          user_id?: string | null
          water_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_id: string
          id: string
          last_seen_at: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_events: {
        Row: {
          created_at: string
          device_id: string
          id: string
          name: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          name: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          name?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      hub_challenges: {
        Row: {
          challenge_id: string
          hub_id: string
          sort: number
        }
        Insert: {
          challenge_id: string
          hub_id: string
          sort?: number
        }
        Update: {
          challenge_id?: string
          hub_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "hub_challenges_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_members: {
        Row: {
          device_id: string
          hub_id: string
          joined_at: string
        }
        Insert: {
          device_id: string
          hub_id: string
          joined_at?: string
        }
        Update: {
          device_id?: string
          hub_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_members_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          active: boolean
          avatar_url: string | null
          cover_url: string | null
          created_at: string
          creator_name: string
          id: string
          name: string
          slug: string
          tagline: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          creator_name?: string
          id?: string
          name: string
          slug: string
          tagline?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          creator_name?: string
          id?: string
          name?: string
          slug?: string
          tagline?: string
        }
        Relationships: []
      }
      meal_entries: {
        Row: {
          carbs_g: number | null
          client_id: string
          created_at: string
          date: string
          device_id: string
          fat_g: number | null
          id: string
          kcal: number | null
          meal_type: string | null
          name: string | null
          payload: Json
          protein_g: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carbs_g?: number | null
          client_id: string
          created_at?: string
          date: string
          device_id: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_type?: string | null
          name?: string | null
          payload?: Json
          protein_g?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carbs_g?: number | null
          client_id?: string
          created_at?: string
          date?: string
          device_id?: string
          fat_g?: number | null
          id?: string
          kcal?: number | null
          meal_type?: string | null
          name?: string | null
          payload?: Json
          protein_g?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_title: string | null
          quantity: number
          total_price: number | null
          unit_price: number | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_title?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_title?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          created_at: string
          currency: string | null
          email: string | null
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          ordered_at: string | null
          raw_snapshot: Json | null
          shopify_customer_id: string | null
          shopify_order_id: string
          total: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          ordered_at?: string | null
          raw_snapshot?: Json | null
          shopify_customer_id?: string | null
          shopify_order_id: string
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          ordered_at?: string | null
          raw_snapshot?: Json | null
          shopify_customer_id?: string | null
          shopify_order_id?: string
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          volume_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_sync_cursors: {
        Row: {
          cursor_value: string | null
          id: string
          updated_at: string
        }
        Insert: {
          cursor_value?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          cursor_value?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopify_webhook_events: {
        Row: {
          id: string
          payload_hash: string
          processed_at: string
          shop_domain: string | null
          topic: string
          webhook_id: string | null
        }
        Insert: {
          id?: string
          payload_hash: string
          processed_at?: string
          shop_domain?: string | null
          topic: string
          webhook_id?: string | null
        }
        Update: {
          id?: string
          payload_hash?: string
          processed_at?: string
          shop_domain?: string | null
          topic?: string
          webhook_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          supplement_ids?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          supplement_ids?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplement_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_id: string
          event_type: string
          idempotency_key: string | null
          occurred_at: string
          payload: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_id?: string
          event_type: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_id?: string
          event_type?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_patterns: {
        Row: {
          patterns: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          patterns?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          patterns?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
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
          user_id: string | null
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          updated_at?: string
          user_id?: string | null
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
