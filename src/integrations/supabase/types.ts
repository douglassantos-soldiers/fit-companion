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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          display_name?: string
          id?: string
          kind: string
          kudos_count?: number
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          display_name?: string
          id?: string
          kind?: string
          kudos_count?: number
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      admin_audit_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          target: Json
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          id?: string
          target?: Json
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          target?: Json
        }
        Relationships: []
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_state: {
        Row: {
          challenges: string[]
          chat: Json
          created_at: string
          device_id: string
          id: string
          retention: Json
          supplement_routine: string[]
          updated_at: string
          user_id: string | null
          version: number | null
        }
        Insert: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id: string
          id?: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
          user_id?: string | null
          version?: number | null
        }
        Update: {
          challenges?: string[]
          chat?: Json
          created_at?: string
          device_id?: string
          id?: string
          retention?: Json
          supplement_routine?: string[]
          updated_at?: string
          user_id?: string | null
          version?: number | null
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
      behavior_experiments: {
        Row: {
          baseline: number
          client_id: string | null
          confidence: number
          created_at: string
          end_date: string
          id: string
          result: number | null
          start_date: string
          status: string
          target: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline?: number
          client_id?: string | null
          confidence?: number
          created_at?: string
          end_date: string
          id?: string
          result?: number | null
          start_date: string
          status?: string
          target: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline?: number
          client_id?: string | null
          confidence?: number
          created_at?: string
          end_date?: string
          id?: string
          result?: number | null
          start_date?: string
          status?: string
          target?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_experiments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_interventions: {
        Row: {
          action: string
          channel: string | null
          confidence: number
          created_at: string
          expected_outcome: string
          id: string
          reason: string
          status: string
          trigger_key: string
          type: string
          user_id: string
        }
        Insert: {
          action: string
          channel?: string | null
          confidence?: number
          created_at?: string
          expected_outcome?: string
          id?: string
          reason?: string
          status?: string
          trigger_key: string
          type: string
          user_id: string
        }
        Update: {
          action?: string
          channel?: string | null
          confidence?: number
          created_at?: string
          expected_outcome?: string
          id?: string
          reason?: string
          status?: string
          trigger_key?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_interventions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_outcomes: {
        Row: {
          id: string
          intervention_id: string | null
          metrics: Json
          observed_at: string
          success: boolean
          user_id: string
        }
        Insert: {
          id?: string
          intervention_id?: string | null
          metrics?: Json
          observed_at?: string
          success: boolean
          user_id: string
        }
        Update: {
          id?: string
          intervention_id?: string | null
          metrics?: Json
          observed_at?: string
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_outcomes_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "behavior_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_outcomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_patterns: {
        Row: {
          confidence: number
          description: string
          evidence: Json
          first_observed_at: string
          id: string
          key: string
          last_observed_at: string
          status: string
          support_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          description?: string
          evidence?: Json
          first_observed_at?: string
          id?: string
          key: string
          last_observed_at?: string
          status?: string
          support_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          description?: string
          evidence?: Json
          first_observed_at?: string
          id?: string
          key?: string
          last_observed_at?: string
          status?: string
          support_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_patterns_user_id_fkey"
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
          user_id: string | null
        }
        Insert: {
          challenge_id: string
          device_id: string
          joined_at?: string
          user_id?: string | null
        }
        Update: {
          challenge_id?: string
          device_id?: string
          joined_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          baseline_value: number
          challenge_id: string
          device_id: string
          fraud_flags: Json
          pct_value: number | null
          personal_target: number | null
          proof_source: string
          proof_status: string
          updated_at: string
          user_id: string | null
          value: number
        }
        Insert: {
          baseline_value?: number
          challenge_id: string
          device_id: string
          fraud_flags?: Json
          pct_value?: number | null
          personal_target?: number | null
          proof_source?: string
          proof_status?: string
          updated_at?: string
          user_id?: string | null
          value?: number
        }
        Update: {
          baseline_value?: number
          challenge_id?: string
          device_id?: string
          fraud_flags?: Json
          pct_value?: number | null
          personal_target?: number | null
          proof_source?: string
          proof_status?: string
          updated_at?: string
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
        }
        Insert: {
          club_id: string
          device_id: string
          joined_at?: string
          user_id?: string | null
        }
        Update: {
          club_id?: string
          device_id?: string
          joined_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      cms_overrides: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          media_url: string | null
          note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          media_url?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          media_url?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      coach_memories: {
        Row: {
          confidence: number
          created_at: string
          id: string
          key: string
          kind: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          key: string
          kind: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          key?: string
          kind?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coach_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_proposals: {
        Row: {
          action: string
          confidence: number
          created_at: string
          date: string
          evidence: Json
          id: string
          reason_codes: string[]
          status: string
          type: string
          user_id: string
          value: Json
        }
        Insert: {
          action: string
          confidence?: number
          created_at?: string
          date: string
          evidence?: Json
          id?: string
          reason_codes?: string[]
          status?: string
          type: string
          user_id: string
          value?: Json
        }
        Update: {
          action?: string
          confidence?: number
          created_at?: string
          date?: string
          evidence?: Json
          id?: string
          reason_codes?: string[]
          status?: string
          type?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coach_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_sessions: {
        Row: {
          client_id: string
          id: string
          message_count: number
          started_at: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          id?: string
          message_count?: number
          started_at?: string
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          id?: string
          message_count?: number
          started_at?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          data_version: number | null
          estimated_ltv: number | null
          estimated_next_purchase: string | null
          favorite_categories: Json
          favorite_products: Json
          first_purchase_at: string | null
          last_purchase_at: string | null
          last_recomputed_at: string | null
          metrics: Json
          nutrition_adherence: number | null
          performance_level: string | null
          purchase_frequency_days: number | null
          recovery_score: number | null
          restock_estimates: Json
          shopify_customer_id: string | null
          supplement_adherence: number | null
          total_orders: number
          total_spend: number
          training_frequency: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_order_value?: number | null
          current_goal?: string | null
          data_version?: number | null
          estimated_ltv?: number | null
          estimated_next_purchase?: string | null
          favorite_categories?: Json
          favorite_products?: Json
          first_purchase_at?: string | null
          last_purchase_at?: string | null
          last_recomputed_at?: string | null
          metrics?: Json
          nutrition_adherence?: number | null
          performance_level?: string | null
          purchase_frequency_days?: number | null
          recovery_score?: number | null
          restock_estimates?: Json
          shopify_customer_id?: string | null
          supplement_adherence?: number | null
          total_orders?: number
          total_spend?: number
          training_frequency?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_order_value?: number | null
          current_goal?: string | null
          data_version?: number | null
          estimated_ltv?: number | null
          estimated_next_purchase?: string | null
          favorite_categories?: Json
          favorite_products?: Json
          first_purchase_at?: string | null
          last_purchase_at?: string | null
          last_recomputed_at?: string | null
          metrics?: Json
          nutrition_adherence?: number | null
          performance_level?: string | null
          purchase_frequency_days?: number | null
          recovery_score?: number | null
          restock_estimates?: Json
          shopify_customer_id?: string | null
          supplement_adherence?: number | null
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
          id: string
          meals: number
          updated_at: string
          user_id: string | null
          water_ml: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          id?: string
          meals?: number
          updated_at?: string
          user_id?: string | null
          water_ml?: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          id?: string
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
      day_checkins: {
        Row: {
          available_time: number | null
          created_at: string
          date: string
          device_id: string | null
          energy: string | null
          equipment: string | null
          id: string
          notes: string | null
          sleep: number | null
          soreness: number | null
          stress: number | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          available_time?: number | null
          created_at?: string
          date: string
          device_id?: string | null
          energy?: string | null
          equipment?: string | null
          id?: string
          notes?: string | null
          sleep?: number | null
          soreness?: number | null
          stress?: number | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          available_time?: number | null
          created_at?: string
          date?: string
          device_id?: string | null
          energy?: string | null
          equipment?: string | null
          id?: string
          notes?: string | null
          sleep?: number | null
          soreness?: number | null
          stress?: number | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_outcomes: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          metadata: Json
          observed_at: string
          outcome_type: string
          user_id: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_type: string
          user_id: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_type?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_outcomes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "recommendation_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_outcomes_user_id_fkey"
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
      exercise_performance: {
        Row: {
          best_reps: number
          best_volume: number
          best_weight: number
          estimated_1rm: number
          exercise_id: string
          id: string
          last_performed_at: string | null
          recent_reps: number
          recent_rpe: string | null
          recent_weight: number
          trend: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_reps?: number
          best_volume?: number
          best_weight?: number
          estimated_1rm?: number
          exercise_id: string
          id?: string
          last_performed_at?: string | null
          recent_reps?: number
          recent_rpe?: string | null
          recent_weight?: number
          trend?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_reps?: number
          best_volume?: number
          best_weight?: number
          estimated_1rm?: number
          exercise_id?: string
          id?: string
          last_performed_at?: string | null
          recent_reps?: number
          recent_rpe?: string | null
          recent_weight?: number
          trend?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_preferences: {
        Row: {
          exercise_id: string
          id: string
          preference: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          preference: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          preference?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          active: boolean
          brand: string | null
          category: string
          confidence: number
          created_at: string
          id: string
          name: string
          per100g: Json
          serving_reference: string
          source: string
          synonyms: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category: string
          confidence?: number
          created_at?: string
          id: string
          name: string
          per100g?: Json
          serving_reference?: string
          source?: string
          synonyms?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          name?: string
          per100g?: Json
          serving_reference?: string
          source?: string
          synonyms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      food_nutrients: {
        Row: {
          confidence: number
          food_id: string
          id: string
          kind: string
          nutrient_key: string
          source: string
          unit: string
          value: number
        }
        Insert: {
          confidence?: number
          food_id: string
          id?: string
          kind?: string
          nutrient_key: string
          source?: string
          unit: string
          value: number
        }
        Update: {
          confidence?: number
          food_id?: string
          id?: string
          kind?: string
          nutrient_key?: string
          source?: string
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_nutrients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_servings: {
        Row: {
          food_id: string
          grams_equivalent: number
          id: string
          is_default: boolean
          label: string
        }
        Insert: {
          food_id: string
          grams_equivalent: number
          id: string
          is_default?: boolean
          label: string
        }
        Update: {
          food_id?: string
          grams_equivalent?: number
          id?: string
          is_default?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_servings_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_items"
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
          user_id_a: string | null
          user_id_b: string | null
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
          user_id_a?: string | null
          user_id_b?: string | null
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
          user_id_a?: string | null
          user_id_b?: string | null
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
          {
            foreignKeyName: "friend_quests_user_id_a_fkey"
            columns: ["user_id_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_quests_user_id_b_fkey"
            columns: ["user_id_b"]
            isOneToOne: false
            referencedRelation: "users"
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
          user_id: string | null
        }
        Insert: {
          device_id: string
          hub_id: string
          joined_at?: string
          user_id?: string | null
        }
        Update: {
          device_id?: string
          hub_id?: string
          joined_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_members_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          fiber_g: number | null
          id: string
          kcal: number | null
          meal_type: string | null
          name: string | null
          payload: Json
          protein_g: number | null
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          carbs_g?: number | null
          client_id: string
          created_at?: string
          date: string
          device_id: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          kcal?: number | null
          meal_type?: string | null
          name?: string | null
          payload?: Json
          protein_g?: number | null
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          carbs_g?: number | null
          client_id?: string
          created_at?: string
          date?: string
          device_id?: string
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          kcal?: number | null
          meal_type?: string | null
          name?: string | null
          payload?: Json
          protein_g?: number | null
          updated_at?: string
          user_id?: string | null
          version?: number
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
      meal_items: {
        Row: {
          client_id: string
          confidence: number
          created_at: string
          device_id: string
          food_id: string | null
          food_name: string | null
          grams: number
          id: string
          meal_client_id: string
          nutrient_snapshot: Json
          quantity: number
          source: string
          source_kind: string
          unit: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          client_id: string
          confidence?: number
          created_at?: string
          device_id?: string
          food_id?: string | null
          food_name?: string | null
          grams?: number
          id?: string
          meal_client_id: string
          nutrient_snapshot?: Json
          quantity?: number
          source?: string
          source_kind?: string
          unit?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          client_id?: string
          confidence?: number
          created_at?: string
          device_id?: string
          food_id?: string | null
          food_name?: string | null
          grams?: number
          id?: string
          meal_client_id?: string
          nutrient_snapshot?: Json
          quantity?: number
          source?: string
          source_kind?: string
          unit?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_load_snapshots: {
        Row: {
          created_at: string
          date: string
          direct_sets: number
          effective_sets: number
          fatigue_contribution: number
          id: string
          indirect_sets: number
          load_trend: string
          muscle: string
          rolling_28d: number
          rolling_7d: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          direct_sets?: number
          effective_sets?: number
          fatigue_contribution?: number
          id?: string
          indirect_sets?: number
          load_trend?: string
          muscle: string
          rolling_28d?: number
          rolling_7d?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          direct_sets?: number
          effective_sets?: number
          fatigue_contribution?: number
          id?: string
          indirect_sets?: number
          load_trend?: string
          muscle?: string
          rolling_28d?: number
          rolling_7d?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_load_snapshots_user_id_fkey"
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
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string
          exercise_id: string | null
          id: string
          label: string | null
          pr_type: string
          previous_value: number | null
          session_id: string | null
          user_id: string
          value: number
        }
        Insert: {
          achieved_at: string
          created_at?: string
          exercise_id?: string | null
          id?: string
          label?: string | null
          pr_type: string
          previous_value?: number | null
          session_id?: string | null
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          exercise_id?: string | null
          id?: string
          label?: string | null
          pr_type?: string
          previous_value?: number | null
          session_id?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_user_id_fkey"
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
          id: string
          level: string
          name: string
          prefs: Json
          restrictions: string[]
          timezone: string | null
          updated_at: string
          user_id: string | null
          version: number
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
          id?: string
          level?: string
          name?: string
          prefs?: Json
          restrictions?: string[]
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
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
          id?: string
          level?: string
          name?: string
          prefs?: Json
          restrictions?: string[]
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
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
      recipe_items: {
        Row: {
          food_id: string
          grams: number
          id: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          food_id: string
          grams: number
          id?: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Update: {
          food_id?: string
          grams?: number
          id?: string
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_minutes: number | null
          created_at: string
          difficulty: string | null
          id: string
          name: string
          prep_minutes: number | null
          servings: number
          source: string
          tags: string[]
          total_macros: Json
        }
        Insert: {
          cook_minutes?: number | null
          created_at?: string
          difficulty?: string | null
          id: string
          name: string
          prep_minutes?: number | null
          servings?: number
          source?: string
          tags?: string[]
          total_macros?: Json
        }
        Update: {
          cook_minutes?: number | null
          created_at?: string
          difficulty?: string | null
          id?: string
          name?: string
          prep_minutes?: number | null
          servings?: number
          source?: string
          tags?: string[]
          total_macros?: Json
        }
        Relationships: []
      }
      recommendation_decisions: {
        Row: {
          confidence: number | null
          created_at: string
          date: string
          decision_type: string
          decision_value: Json
          engine: string
          evidence: Json
          id: string
          input_snapshot: Json
          outcome: string | null
          outcome_metrics: Json | null
          reason_codes: string[]
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          date: string
          decision_type: string
          decision_value: Json
          engine?: string
          evidence?: Json
          id?: string
          input_snapshot?: Json
          outcome?: string | null
          outcome_metrics?: Json | null
          reason_codes?: string[]
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          date?: string
          decision_type?: string
          decision_value?: Json
          engine?: string
          evidence?: Json
          id?: string
          input_snapshot?: Json
          outcome?: string | null
          outcome_metrics?: Json | null
          reason_codes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_decisions_user_id_fkey"
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
          express: boolean | null
          id: string
          rpe: string | null
          title: string
          updated_at: string
          user_id: string | null
          version: number
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
          express?: boolean | null
          id?: string
          rpe?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          version?: number
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
          express?: boolean | null
          id?: string
          rpe?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          version?: number
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
          app_user_id: string | null
          avatar_url: string | null
          bio: string | null
          device_id: string
          display_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          device_id: string
          display_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          device_id?: string
          display_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      soldiers_media: {
        Row: {
          created_at: string
          duration_sec: number | null
          entity_id: string
          gif_url: string | null
          kind: string
          license: string
          mp4_url: string | null
          needs_motion: boolean
          ownership: string
          poster_url: string | null
          qa_notes: string | null
          source: string
          status: string
          style: string
          thumbnail_url: string | null
          updated_at: string
          version: string
          webm_url: string | null
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          entity_id: string
          gif_url?: string | null
          kind: string
          license?: string
          mp4_url?: string | null
          needs_motion?: boolean
          ownership?: string
          poster_url?: string | null
          qa_notes?: string | null
          source?: string
          status?: string
          style?: string
          thumbnail_url?: string | null
          updated_at?: string
          version?: string
          webm_url?: string | null
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          entity_id?: string
          gif_url?: string | null
          kind?: string
          license?: string
          mp4_url?: string | null
          needs_motion?: boolean
          ownership?: string
          poster_url?: string | null
          qa_notes?: string | null
          source?: string
          status?: string
          style?: string
          thumbnail_url?: string | null
          updated_at?: string
          version?: string
          webm_url?: string | null
        }
        Relationships: []
      }
      supplement_dose_logs: {
        Row: {
          client_id: string
          created_at: string
          device_id: string | null
          dose: number
          frequency: string
          id: string
          product_id: string
          source: string
          taken_at: string
          unit: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          device_id?: string | null
          dose?: number
          frequency?: string
          id?: string
          product_id: string
          source?: string
          taken_at?: string
          unit?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          device_id?: string | null
          dose?: number
          frequency?: string
          id?: string
          product_id?: string
          source?: string
          taken_at?: string
          unit?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplement_dose_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_logs: {
        Row: {
          created_at: string
          date: string
          device_id: string
          id: string
          supplement_ids: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          id?: string
          supplement_ids?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          id?: string
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
          entity_id: string | null
          entity_type: string | null
          event_id: string
          event_type: string
          idempotency_key: string | null
          metadata: Json
          occurred_at: string
          payload: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string
          event_type: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          payload?: Json
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string
          event_type?: string
          idempotency_key?: string | null
          metadata?: Json
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
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weights: {
        Row: {
          created_at: string
          date: string
          device_id: string
          id: string
          updated_at: string
          user_id: string | null
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date: string
          device_id: string
          id?: string
          updated_at?: string
          user_id?: string | null
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          device_id?: string
          id?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

