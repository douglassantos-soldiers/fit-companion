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
      activities: {
        Row: {
          calories: number | null
          created_at: string
          device: string | null
          distance_m: number | null
          duration_sec: number | null
          external_id: string | null
          id: string
          metrics: Json
          proof_status: string
          source: string
          started_at: string
          type: string
          user_id: string
        }
        Insert: {
          calories?: number | null
          created_at?: string
          device?: string | null
          distance_m?: number | null
          duration_sec?: number | null
          external_id?: string | null
          id: string
          metrics?: Json
          proof_status?: string
          source: string
          started_at: string
          type: string
          user_id: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          device?: string | null
          distance_m?: number | null
          duration_sec?: number | null
          external_id?: string | null
          id?: string
          metrics?: Json
          proof_status?: string
          source?: string
          started_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          created_at: string
          device_id: string
          display_name: string
          hidden_at: string | null
          hidden_by: string | null
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
          hidden_at?: string | null
          hidden_by?: string | null
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
          hidden_at?: string | null
          hidden_by?: string | null
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
      activity_reactions: {
        Row: {
          created_at: string
          event_id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      body_measurements: {
        Row: {
          arm_cm: number | null
          chest_cm: number | null
          created_at: string
          date: string
          device_id: string | null
          hip_cm: number | null
          id: string
          thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          arm_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          date: string
          device_id?: string | null
          hip_cm?: number | null
          id?: string
          thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          arm_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          device_id?: string | null
          hip_cm?: number | null
          id?: string
          thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_challenges: {
        Row: {
          active: boolean
          category: string
          description: string
          duration_days: number
          ends_at: string | null
          id: string
          metric: string
          personal_target_factor: number | null
          personal_target_max: number | null
          personal_target_min: number | null
          personal_target_offset: number | null
          ranking_mode: string
          requires_performance: boolean
          reward: string | null
          starts_at: string | null
          target: number
          target_pct: number | null
          title: string
          unit: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          category?: string
          description?: string
          duration_days?: number
          ends_at?: string | null
          id: string
          metric?: string
          personal_target_factor?: number | null
          personal_target_max?: number | null
          personal_target_min?: number | null
          personal_target_offset?: number | null
          ranking_mode?: string
          requires_performance?: boolean
          reward?: string | null
          starts_at?: string | null
          target?: number
          target_pct?: number | null
          title: string
          unit?: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          active?: boolean
          category?: string
          description?: string
          duration_days?: number
          ends_at?: string | null
          id?: string
          metric?: string
          personal_target_factor?: number | null
          personal_target_max?: number | null
          personal_target_min?: number | null
          personal_target_offset?: number | null
          ranking_mode?: string
          requires_performance?: boolean
          reward?: string | null
          starts_at?: string | null
          target?: number
          target_pct?: number | null
          title?: string
          unit?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      catalog_exercises: {
        Row: {
          active: boolean
          aliases: string[]
          alternative_ids: string[]
          animation_spec: Json | null
          base_load: number
          canonical_name: string | null
          contraindication_tags: string[]
          cues: string | null
          difficulty: string | null
          display_name_en: string | null
          equipment: string
          equipment_inventory: string[]
          exercise_family: string | null
          id: string
          instructions: string[]
          joints: string[]
          media_id: string | null
          media_status: string | null
          media_url: string | null
          movement_family: string | null
          movement_pattern: string | null
          muscle_group: string
          name: string
          planner_eligible: boolean
          primary_muscles: string[]
          priority: number
          progression_family: string | null
          regression_family: string | null
          search_terms: string[]
          secondary_muscles: string[]
          swap_group: string
          unit: string
          updated_at: string
          updated_by: string
          version: number
          video_url: string | null
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          alternative_ids?: string[]
          animation_spec?: Json | null
          base_load?: number
          canonical_name?: string | null
          contraindication_tags?: string[]
          cues?: string | null
          difficulty?: string | null
          display_name_en?: string | null
          equipment: string
          equipment_inventory?: string[]
          exercise_family?: string | null
          id: string
          instructions?: string[]
          joints?: string[]
          media_id?: string | null
          media_status?: string | null
          media_url?: string | null
          movement_family?: string | null
          movement_pattern?: string | null
          muscle_group: string
          name: string
          planner_eligible?: boolean
          primary_muscles?: string[]
          priority?: number
          progression_family?: string | null
          regression_family?: string | null
          search_terms?: string[]
          secondary_muscles?: string[]
          swap_group?: string
          unit?: string
          updated_at?: string
          updated_by?: string
          version?: number
          video_url?: string | null
        }
        Update: {
          active?: boolean
          aliases?: string[]
          alternative_ids?: string[]
          animation_spec?: Json | null
          base_load?: number
          canonical_name?: string | null
          contraindication_tags?: string[]
          cues?: string | null
          difficulty?: string | null
          display_name_en?: string | null
          equipment?: string
          equipment_inventory?: string[]
          exercise_family?: string | null
          id?: string
          instructions?: string[]
          joints?: string[]
          media_id?: string | null
          media_status?: string | null
          media_url?: string | null
          movement_family?: string | null
          movement_pattern?: string | null
          muscle_group?: string
          name?: string
          planner_eligible?: boolean
          primary_muscles?: string[]
          priority?: number
          progression_family?: string | null
          regression_family?: string | null
          search_terms?: string[]
          secondary_muscles?: string[]
          swap_group?: string
          unit?: string
          updated_at?: string
          updated_by?: string
          version?: number
          video_url?: string | null
        }
        Relationships: []
      }
      catalog_settings: {
        Row: {
          id: string
          taco_license_verified: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          taco_license_verified?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          taco_license_verified?: boolean
          updated_at?: string
        }
        Relationships: []
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
      challenge_invites: {
        Row: {
          challenge_id: string
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_invites_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_invites_to_user_id_fkey"
            columns: ["to_user_id"]
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
          authorized: boolean
          authorized_at: string | null
          authorized_by: string | null
          entity_id: string
          entity_type: string
          id: string
          media_url: string | null
          note: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          authorized?: boolean
          authorized_at?: string | null
          authorized_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          media_url?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string
        }
        Update: {
          authorized?: boolean
          authorized_at?: string | null
          authorized_by?: string | null
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
      content_collections: {
        Row: {
          cover_media_id: string | null
          created_at: string
          expert_id: string | null
          id: string
          kind: string
          published: boolean
          sort_order: number
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          expert_id?: string | null
          id: string
          kind?: string
          published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          expert_id?: string | null
          id?: string
          kind?: string
          published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_collections_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_dismissals: {
        Row: {
          content_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_impressions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          body: string
          collection_id: string | null
          created_at: string
          expert_id: string | null
          goals: string[]
          id: string
          kind: string
          levels: string[]
          media_id: string | null
          media_url: string | null
          publish_at: string | null
          published: boolean
          sort_order: number
          title: string
          unpublish_at: string | null
          updated_at: string
          updated_by: string
          visible: boolean
        }
        Insert: {
          body?: string
          collection_id?: string | null
          created_at?: string
          expert_id?: string | null
          goals?: string[]
          id?: string
          kind: string
          levels?: string[]
          media_id?: string | null
          media_url?: string | null
          publish_at?: string | null
          published?: boolean
          sort_order?: number
          title: string
          unpublish_at?: string | null
          updated_at?: string
          updated_by?: string
          visible?: boolean
        }
        Update: {
          body?: string
          collection_id?: string | null
          created_at?: string
          expert_id?: string | null
          goals?: string[]
          id?: string
          kind?: string
          levels?: string[]
          media_id?: string | null
          media_url?: string | null
          publish_at?: string | null
          published?: boolean
          sort_order?: number
          title?: string
          unpublish_at?: string | null
          updated_at?: string
          updated_by?: string
          visible?: boolean
        }
        Relationships: []
      }
      content_progress: {
        Row: {
          completed_at: string | null
          completion_percent: number
          content_id: string
          dismissed: boolean
          saved: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_percent?: number
          content_id: string
          dismissed?: boolean
          saved?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_percent?: number
          content_id?: string
          dismissed?: boolean
          saved?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_user_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_kind?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
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
      decision_actions: {
        Row: {
          actual_action: string | null
          completed_at: string | null
          created_at: string
          date: string
          decision_id: string
          entity_id: string | null
          entity_type: string | null
          expected_action: string
          id: string
          metadata: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_action?: string | null
          completed_at?: string | null
          created_at?: string
          date: string
          decision_id: string
          entity_id?: string | null
          entity_type?: string | null
          expected_action: string
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_action?: string | null
          completed_at?: string | null
          created_at?: string
          date?: string
          decision_id?: string
          entity_id?: string | null
          entity_type?: string | null
          expected_action?: string
          id?: string
          metadata?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_actions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: true
            referencedRelation: "recommendation_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_context_snapshots: {
        Row: {
          created_at: string
          customer360_version: number | null
          date: string
          engine: string
          id: string
          input_fingerprint: string
          payload: Json
          snapshot_version: number
          stale360: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer360_version?: number | null
          date: string
          engine?: string
          id?: string
          input_fingerprint: string
          payload?: Json
          snapshot_version?: number
          stale360?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer360_version?: number | null
          date?: string
          engine?: string
          id?: string
          input_fingerprint?: string
          payload?: Json
          snapshot_version?: number
          stale360?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_context_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_outcomes: {
        Row: {
          action_id: string | null
          attribution_confidence: number | null
          attribution_type: string
          created_at: string
          decision_id: string
          id: string
          learning_signal: string | null
          metadata: Json
          observed_at: string
          outcome_quality: string
          outcome_type: string
          outcome_window: string
          user_id: string
          value: Json | null
        }
        Insert: {
          action_id?: string | null
          attribution_confidence?: number | null
          attribution_type?: string
          created_at?: string
          decision_id: string
          id?: string
          learning_signal?: string | null
          metadata?: Json
          observed_at?: string
          outcome_quality?: string
          outcome_type: string
          outcome_window?: string
          user_id: string
          value?: Json | null
        }
        Update: {
          action_id?: string | null
          attribution_confidence?: number | null
          attribution_type?: string
          created_at?: string
          decision_id?: string
          id?: string
          learning_signal?: string | null
          metadata?: Json
          observed_at?: string
          outcome_quality?: string
          outcome_type?: string
          outcome_window?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_outcomes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "decision_actions"
            referencedColumns: ["id"]
          },
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
      experts: {
        Row: {
          active: boolean
          bio: string
          created_at: string
          id: string
          name: string
          photo_media_id: string | null
          social: Json
          specialty: string
          updated_at: string
          updated_by: string
          verified: boolean
        }
        Insert: {
          active?: boolean
          bio?: string
          created_at?: string
          id: string
          name: string
          photo_media_id?: string | null
          social?: Json
          specialty?: string
          updated_at?: string
          updated_by?: string
          verified?: boolean
        }
        Update: {
          active?: boolean
          bio?: string
          created_at?: string
          id?: string
          name?: string
          photo_media_id?: string | null
          social?: Json
          specialty?: string
          updated_at?: string
          updated_by?: string
          verified?: boolean
        }
        Relationships: []
      }
      feed_dismissals: {
        Row: {
          author_user_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          author_user_id: string
          created_at?: string
          kind: string
          user_id: string
        }
        Update: {
          author_user_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_dismissals_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_impressions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_impressions_user_id_fkey"
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
          ean: string | null
          id: string
          name: string
          per100g: Json
          serving_reference: string
          source: string
          source_version: string | null
          synonyms: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category: string
          confidence?: number
          created_at?: string
          ean?: string | null
          id: string
          name: string
          per100g?: Json
          serving_reference?: string
          source?: string
          source_version?: string | null
          synonyms?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string
          confidence?: number
          created_at?: string
          ean?: string | null
          id?: string
          name?: string
          per100g?: Json
          serving_reference?: string
          source?: string
          source_version?: string | null
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
      program_sessions: {
        Row: {
          content_item_id: string | null
          day: number
          id: string
          nutrition_json: Json
          program_id: string
          recovery_json: Json
          training_json: Json
          updated_at: string
          week: number
        }
        Insert: {
          content_item_id?: string | null
          day?: number
          id: string
          nutrition_json?: Json
          program_id: string
          recovery_json?: Json
          training_json?: Json
          updated_at?: string
          week?: number
        }
        Update: {
          content_item_id?: string | null
          day?: number
          id?: string
          nutrition_json?: Json
          program_id?: string
          recovery_json?: Json
          training_json?: Json
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          cover_media_id: string | null
          created_at: string
          description: string
          duration_weeks: number
          expert_ids: string[]
          goal: string | null
          id: string
          level: string | null
          publish_at: string | null
          published: boolean
          sessions_per_week: number
          title: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          cover_media_id?: string | null
          created_at?: string
          description?: string
          duration_weeks?: number
          expert_ids?: string[]
          goal?: string | null
          id: string
          level?: string | null
          publish_at?: string | null
          published?: boolean
          sessions_per_week?: number
          title: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          cover_media_id?: string | null
          created_at?: string
          description?: string
          duration_weeks?: number
          expert_ids?: string[]
          goal?: string | null
          id?: string
          level?: string | null
          publish_at?: string | null
          published?: boolean
          sessions_per_week?: number
          title?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          pose: string
          storage_path: string
          taken_on: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          pose: string
          storage_path: string
          taken_on: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          pose?: string
          storage_path?: string
          taken_on?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_sends: {
        Row: {
          category: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          category: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          category?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_sends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
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
      social_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_mutes: {
        Row: {
          created_at: string
          muted_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_mutes_muted_id_fkey"
            columns: ["muted_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          app_user_id: string | null
          avatar_url: string | null
          bio: string | null
          device_id: string
          display_name: string
          privacy_nutrition: string
          privacy_photos: string
          privacy_profile: string
          privacy_prs: string
          privacy_weight: string
          privacy_workouts: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          device_id: string
          display_name?: string
          privacy_nutrition?: string
          privacy_photos?: string
          privacy_profile?: string
          privacy_prs?: string
          privacy_weight?: string
          privacy_workouts?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          device_id?: string
          display_name?: string
          privacy_nutrition?: string
          privacy_photos?: string
          privacy_profile?: string
          privacy_prs?: string
          privacy_weight?: string
          privacy_workouts?: string
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
          animation_spec: Json | null
          checksums: Json | null
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
          prompt: string | null
          qa_notes: string | null
          region: string
          source: string
          status: string
          style: string
          thumbnail_url: string | null
          updated_at: string
          variant: string
          version: string
          webm_url: string | null
        }
        Insert: {
          animation_spec?: Json | null
          checksums?: Json | null
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
          prompt?: string | null
          qa_notes?: string | null
          region?: string
          source?: string
          status?: string
          style?: string
          thumbnail_url?: string | null
          updated_at?: string
          variant?: string
          version?: string
          webm_url?: string | null
        }
        Update: {
          animation_spec?: Json | null
          checksums?: Json | null
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
          prompt?: string | null
          qa_notes?: string | null
          region?: string
          source?: string
          status?: string
          style?: string
          thumbnail_url?: string | null
          updated_at?: string
          variant?: string
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
      training_rules: {
        Row: {
          id: string
          payload: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string
        }
        Update: {
          id?: string
          payload?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
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
          status: string
          status_reason: string | null
          status_until: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          status?: string
          status_reason?: string | null
          status_until?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          status?: string
          status_reason?: string | null
          status_until?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wearable_connections: {
        Row: {
          access_token: string | null
          expires_at: string | null
          provider: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: string | null
          provider: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          expires_at?: string | null
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
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
  public: {
    Enums: {},
  },
} as const
