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
      access_rights: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          project_id: string
          role: string | null
          section_key: string
          user_id: string | null
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          project_id: string
          role?: string | null
          section_key: string
          user_id?: string | null
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          project_id?: string
          role?: string | null
          section_key?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_rights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_rights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          currency: string | null
          daily_budget: number | null
          external_id: string
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          platform: string
          project_id: string
          status: string | null
          synced_at: string
        }
        Insert: {
          currency?: string | null
          daily_budget?: number | null
          external_id: string
          id?: string
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          platform: string
          project_id: string
          status?: string | null
          synced_at?: string
        }
        Update: {
          currency?: string | null
          daily_budget?: number | null
          external_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          platform?: string
          project_id?: string
          status?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creative_insights_daily: {
        Row: {
          clicks: number
          creative_id: string
          currency: string | null
          date: string
          id: string
          impressions: number
          leads: number
          project_id: string
          reach: number
          spend: number
          spend_source: number
        }
        Insert: {
          clicks?: number
          creative_id: string
          currency?: string | null
          date: string
          id?: string
          impressions?: number
          leads?: number
          project_id: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Update: {
          clicks?: number
          creative_id?: string
          currency?: string | null
          date?: string
          id?: string
          impressions?: number
          leads?: number
          project_id?: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_creative_insights_daily_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creative_insights_daily_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights_daily: {
        Row: {
          campaign_id: string
          clicks: number
          currency: string | null
          date: string
          id: string
          impressions: number
          leads: number
          project_id: string
          reach: number
          spend: number
          spend_source: number
        }
        Insert: {
          campaign_id: string
          clicks?: number
          currency?: string | null
          date: string
          id?: string
          impressions?: number
          leads?: number
          project_id: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Update: {
          campaign_id?: string
          clicks?: number
          currency?: string | null
          date?: string
          id?: string
          impressions?: number
          leads?: number
          project_id?: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_insights_daily_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_set_insights_daily: {
        Row: {
          ad_set_id: string
          clicks: number
          currency: string | null
          date: string
          id: string
          impressions: number
          leads: number
          project_id: string
          reach: number
          spend: number
          spend_source: number
        }
        Insert: {
          ad_set_id: string
          clicks?: number
          currency?: string | null
          date: string
          id?: string
          impressions?: number
          leads?: number
          project_id: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Update: {
          ad_set_id?: string
          clicks?: number
          currency?: string | null
          date?: string
          id?: string
          impressions?: number
          leads?: number
          project_id?: string
          reach?: number
          spend?: number
          spend_source?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_set_insights_daily_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_set_insights_daily_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          campaign_id: string | null
          currency: string | null
          daily_budget: number | null
          destination: string | null
          external_id: string
          id: string
          lifetime_budget: number | null
          name: string
          platform: string
          project_id: string
          status: string | null
          synced_at: string
        }
        Insert: {
          campaign_id?: string | null
          currency?: string | null
          daily_budget?: number | null
          destination?: string | null
          external_id: string
          id?: string
          lifetime_budget?: number | null
          name: string
          platform?: string
          project_id: string
          status?: string | null
          synced_at?: string
        }
        Update: {
          campaign_id?: string | null
          currency?: string | null
          daily_budget?: number | null
          destination?: string | null
          external_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          platform?: string
          project_id?: string
          status?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          project_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          note?: string | null
          project_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          project_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          ad_headline: string | null
          channel: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          creative_id: string | null
          external_id: string
          id: string
          last_message: string | null
          last_message_at: string | null
          lead_id: string | null
          message_count: number
          project_id: string
        }
        Insert: {
          ad_headline?: string | null
          channel?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          creative_id?: string | null
          external_id: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number
          project_id: string
        }
        Update: {
          ad_headline?: string | null
          channel?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          creative_id?: string | null
          external_id?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          project_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          project_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_webhooks: {
        Row: {
          hint: string | null
          issued_at: string
          issued_by: string | null
          last_received_at: string | null
          project_id: string
          received_count: number
          token_hash: string
        }
        Insert: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id: string
          received_count?: number
          token_hash: string
        }
        Update: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id?: string
          received_count?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_webhooks_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          ends_on: string | null
          id: string
          kind: string
          note: string | null
          number: string | null
          project_id: string
          starts_on: string | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          kind?: string
          note?: string | null
          number?: string | null
          project_id: string
          starts_on?: string | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          kind?: string
          note?: string | null
          number?: string | null
          project_id?: string
          starts_on?: string | null
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          ad_set_id: string | null
          campaign_id: string | null
          created_at: string
          external_id: string | null
          id: string
          media_type: string | null
          name: string
          platform: string | null
          preview_url: string | null
          project_id: string
          status: string | null
          synced_at: string
          thumbnail_url: string | null
        }
        Insert: {
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          media_type?: string | null
          name: string
          platform?: string | null
          preview_url?: string | null
          project_id: string
          status?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Update: {
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          media_type?: string | null
          name?: string
          platform?: string | null
          preview_url?: string | null
          project_id?: string
          status?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          first_purchase_at: string | null
          full_name: string
          id: string
          phone: string | null
          project_id: string
          total_spent: number
        }
        Insert: {
          created_at?: string
          first_purchase_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
          project_id: string
          total_spent?: number
        }
        Update: {
          created_at?: string
          first_purchase_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          project_id?: string
          total_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_reports: {
        Row: {
          author_id: string
          content: Json | null
          created_at: string
          id: string
          project_id: string
          report_date: string
        }
        Insert: {
          author_id: string
          content?: Json | null
          created_at?: string
          id?: string
          project_id: string
          report_date: string
        }
        Update: {
          author_id?: string
          content?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          report_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          auth_tag: string
          ciphertext: string
          hint: string | null
          integration_id: string
          iv: string
          project_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_tag: string
          ciphertext: string
          hint?: string | null
          integration_id: string
          iv: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_tag?: string
          ciphertext?: string
          hint?: string | null
          integration_id?: string
          iv?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_secrets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_secrets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_secrets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          project_id: string
          provider: string
          status: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          project_id: string
          provider: string
          status?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake: {
        Row: {
          hint: string | null
          issued_at: string
          issued_by: string | null
          last_received_at: string | null
          project_id: string
          received_count: number
          token_hash: string
        }
        Insert: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id: string
          received_count?: number
          token_hash: string
        }
        Update: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id?: string
          received_count?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_intake_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intake_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          creative_id: string | null
          full_name: string
          id: string
          phone: string | null
          project_id: string
          source: string | null
          status: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          creative_id?: string | null
          full_name: string
          id?: string
          phone?: string | null
          project_id: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          creative_id?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          project_id?: string
          source?: string | null
          status?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_daily: {
        Row: {
          ad_spend: number
          date: string
          id: string
          leads: number
          project_id: string
          qualified: number
          revenue: number
          sales: number
          trial_lessons: number
        }
        Insert: {
          ad_spend?: number
          date: string
          id?: string
          leads?: number
          project_id: string
          qualified?: number
          revenue?: number
          sales?: number
          trial_lessons?: number
        }
        Update: {
          ad_spend?: number
          date?: string
          id?: string
          leads?: number
          project_id?: string
          qualified?: number
          revenue?: number
          sales?: number
          trial_lessons?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_daily_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          project_id: string
          sale_price: number
          sku: string | null
          stock_quantity: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          project_id: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          project_id?: string
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          global_role: string
          id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          global_role?: string
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          global_role?: string
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          fired_at: string | null
          hired_at: string
          id: string
          project_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          fired_at?: string | null
          hired_at?: string
          id?: string
          project_id: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          fired_at?: string | null
          hired_at?: string
          id?: string
          project_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sections: {
        Row: {
          enabled: boolean
          id: string
          project_id: string
          section_key: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          project_id: string
          section_key: string
        }
        Update: {
          enabled?: boolean
          id?: string
          project_id?: string
          section_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          accent_color: string | null
          ad_spend_rate: number
          cpl_limit: number
          created_at: string
          currency: string
          description: string | null
          director_name: string | null
          icon: string | null
          id: string
          name: string
          niche: string
          owner_id: string
          plan: string
          status: string
        }
        Insert: {
          accent_color?: string | null
          ad_spend_rate?: number
          cpl_limit?: number
          created_at?: string
          currency?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          name: string
          niche: string
          owner_id: string
          plan?: string
          status?: string
        }
        Update: {
          accent_color?: string | null
          ad_spend_rate?: number
          cpl_limit?: number
          created_at?: string
          currency?: string
          description?: string | null
          director_name?: string | null
          icon?: string | null
          id?: string
          name?: string
          niche?: string
          owner_id?: string
          plan?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          id: string
          label: string | null
          project_id: string
          type: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          type: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          type?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          amount: number
          created_at: string
          id: string
          processed_by: string | null
          project_id: string
          reason: string | null
          sale_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          processed_by?: string | null
          project_id: string
          reason?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          processed_by?: string | null
          project_id?: string
          reason?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_rules: {
        Row: {
          base_salary: number
          created_at: string
          id: string
          per_qualified_lead: number
          per_trial: number
          percent_of_sales: number
          project_id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          base_salary?: number
          created_at?: string
          id?: string
          per_qualified_lead?: number
          per_trial?: number
          percent_of_sales?: number
          project_id: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          base_salary?: number
          created_at?: string
          id?: string
          per_qualified_lead?: number
          per_trial?: number
          percent_of_sales?: number
          project_id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          creative_id: string | null
          customer_id: string | null
          id: string
          lead_id: string | null
          product: string | null
          project_id: string
          seller_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          creative_id?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          product?: string | null
          project_id: string
          seller_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          creative_id?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          product?: string | null
          project_id?: string
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_funnels: {
        Row: {
          created_at: string
          created_by: string | null
          creative_id: string | null
          id: string
          name: string
          project_id: string
          range_preset: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creative_id?: string | null
          id?: string
          name: string
          project_id: string
          range_preset?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creative_id?: string | null
          id?: string
          name?: string
          project_id?: string
          range_preset?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_funnels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_funnels_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_funnels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_accounts: {
        Row: {
          chat_id: string | null
          code: string
          code_issued_at: string
          id: string
          linked_at: string | null
          project_id: string
          status: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id?: string | null
          code: string
          code_issued_at?: string
          id?: string
          linked_at?: string | null
          project_id: string
          status?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: string | null
          code?: string
          code_issued_at?: string
          id?: string
          linked_at?: string | null
          project_id?: string
          status?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_accounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_webhooks: {
        Row: {
          hint: string | null
          issued_at: string
          issued_by: string | null
          last_received_at: string | null
          project_id: string
          received_count: number
          token_hash: string
        }
        Insert: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id: string
          received_count?: number
          token_hash: string
        }
        Update: {
          hint?: string | null
          issued_at?: string
          issued_by?: string | null
          last_received_at?: string | null
          project_id?: string
          received_count?: number
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_webhooks_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          ends_at: string | null
          id: string
          is_dayoff: boolean
          project_id: string
          starts_at: string | null
          user_id: string
          weekday: number
        }
        Insert: {
          ends_at?: string | null
          id?: string
          is_dayoff?: boolean
          project_id: string
          starts_at?: string | null
          user_id: string
          weekday: number
        }
        Update: {
          ends_at?: string | null
          id?: string
          is_dayoff?: boolean
          project_id?: string
          starts_at?: string | null
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_profile: { Args: { target: string }; Returns: boolean }
      has_project_role: {
        Args: { pid: string; roles: string[] }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_project_member: { Args: { pid: string }; Returns: boolean }
      owns_project: { Args: { pid: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
