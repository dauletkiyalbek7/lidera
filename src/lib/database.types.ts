/**
 * Типы базы данных Lidera.
 * Сгенерировано из схемы Supabase; при изменении миграций перегенерировать.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ad_creative_insights_daily: {
        Row: {
          clicks: number;
          creative_id: string;
          currency: string | null;
          date: string;
          id: string;
          impressions: number;
          reach: number;
          leads: number;
          project_id: string;
          spend: number;
          spend_source: number;
        };
        Insert: {
          clicks?: number;
          creative_id: string;
          currency?: string | null;
          date: string;
          id?: string;
          impressions?: number;
          reach?: number;
          leads?: number;
          project_id: string;
          spend?: number;
          spend_source?: number;
        };
        Update: {
          clicks?: number;
          creative_id?: string;
          currency?: string | null;
          date?: string;
          id?: string;
          impressions?: number;
          reach?: number;
          leads?: number;
          project_id?: string;
          spend?: number;
          spend_source?: number;
        };
        Relationships: [];
      };
      telegram_webhooks: {
        Row: {
          hint: string | null;
          issued_at: string;
          issued_by: string | null;
          last_received_at: string | null;
          project_id: string;
          received_count: number;
          token_hash: string;
        };
        Insert: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id: string;
          received_count?: number;
          token_hash: string;
        };
        Update: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id?: string;
          received_count?: number;
          token_hash?: string;
        };
        Relationships: [];
      };
      telegram_accounts: {
        Row: {
          chat_id: string | null;
          code: string;
          code_issued_at: string;
          id: string;
          linked_at: string | null;
          project_id: string;
          status: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          chat_id?: string | null;
          code: string;
          code_issued_at?: string;
          id?: string;
          linked_at?: string | null;
          project_id: string;
          status?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          chat_id?: string | null;
          code?: string;
          code_issued_at?: string;
          id?: string;
          linked_at?: string | null;
          project_id?: string;
          status?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      chat_webhooks: {
        Row: {
          hint: string | null;
          issued_at: string;
          issued_by: string | null;
          last_received_at: string | null;
          project_id: string;
          received_count: number;
          token_hash: string;
        };
        Insert: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id: string;
          received_count?: number;
          token_hash: string;
        };
        Update: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id?: string;
          received_count?: number;
          token_hash?: string;
        };
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          channel: string;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          external_id: string;
          id: string;
          last_message: string | null;
          last_message_at: string | null;
          lead_id: string | null;
          message_count: number;
          project_id: string;
        };
        Insert: {
          channel?: string;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          external_id: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string | null;
          lead_id?: string | null;
          message_count?: number;
          project_id: string;
        };
        Update: {
          channel?: string;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          external_id?: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string | null;
          lead_id?: string | null;
          message_count?: number;
          project_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          body: string | null;
          conversation_id: string;
          created_at: string;
          direction: string;
          id: string;
          project_id: string;
        };
        Insert: {
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          direction?: string;
          id?: string;
          project_id: string;
        };
        Update: {
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          direction?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          currency: string | null;
          daily_budget: number | null;
          external_id: string;
          id: string;
          lifetime_budget: number | null;
          name: string;
          objective: string | null;
          platform: string;
          project_id: string;
          status: string | null;
          synced_at: string;
        };
        Insert: {
          currency?: string | null;
          daily_budget?: number | null;
          external_id: string;
          id?: string;
          lifetime_budget?: number | null;
          name: string;
          objective?: string | null;
          platform: string;
          project_id: string;
          status?: string | null;
          synced_at?: string;
        };
        Update: {
          currency?: string | null;
          daily_budget?: number | null;
          external_id?: string;
          id?: string;
          lifetime_budget?: number | null;
          name?: string;
          objective?: string | null;
          platform?: string;
          project_id?: string;
          status?: string | null;
          synced_at?: string;
        };
        Relationships: [];
      };
      ad_insights_daily: {
        Row: {
          campaign_id: string;
          clicks: number;
          currency: string | null;
          date: string;
          id: string;
          impressions: number;
          reach: number;
          leads: number;
          project_id: string;
          spend: number;
          spend_source: number;
        };
        Insert: {
          campaign_id: string;
          clicks?: number;
          currency?: string | null;
          date: string;
          id?: string;
          impressions?: number;
          reach?: number;
          leads?: number;
          project_id: string;
          spend?: number;
          spend_source?: number;
        };
        Update: {
          campaign_id?: string;
          clicks?: number;
          currency?: string | null;
          date?: string;
          id?: string;
          impressions?: number;
          reach?: number;
          leads?: number;
          project_id?: string;
          spend?: number;
          spend_source?: number;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          marked_by: string | null;
          note: string | null;
          project_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          marked_by?: string | null;
          note?: string | null;
          project_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          marked_by?: string | null;
          note?: string | null;
          project_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          amount: number;
          counterparty: string | null;
          created_at: string;
          ends_on: string | null;
          id: string;
          kind: string;
          note: string | null;
          number: string | null;
          project_id: string;
          starts_on: string | null;
          status: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          amount?: number;
          counterparty?: string | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          number?: string | null;
          project_id: string;
          starts_on?: string | null;
          status?: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          counterparty?: string | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          number?: string | null;
          project_id?: string;
          starts_on?: string | null;
          status?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      saved_funnels: {
        Row: {
          created_at: string;
          created_by: string | null;
          creative_id: string | null;
          id: string;
          name: string;
          project_id: string;
          range_preset: string | null;
          source: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          creative_id?: string | null;
          id?: string;
          name: string;
          project_id: string;
          range_preset?: string | null;
          source?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          creative_id?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          range_preset?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      salary_rules: {
        Row: {
          base_salary: number;
          created_at: string;
          id: string;
          per_qualified_lead: number;
          per_trial: number;
          percent_of_sales: number;
          project_id: string;
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          base_salary?: number;
          created_at?: string;
          id?: string;
          per_qualified_lead?: number;
          per_trial?: number;
          percent_of_sales?: number;
          project_id: string;
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          base_salary?: number;
          created_at?: string;
          id?: string;
          per_qualified_lead?: number;
          per_trial?: number;
          percent_of_sales?: number;
          project_id?: string;
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      work_shifts: {
        Row: {
          ends_at: string | null;
          id: string;
          is_dayoff: boolean;
          project_id: string;
          starts_at: string | null;
          user_id: string;
          weekday: number;
        };
        Insert: {
          ends_at?: string | null;
          id?: string;
          is_dayoff?: boolean;
          project_id: string;
          starts_at?: string | null;
          user_id: string;
          weekday: number;
        };
        Update: {
          ends_at?: string | null;
          id?: string;
          is_dayoff?: boolean;
          project_id?: string;
          starts_at?: string | null;
          user_id?: string;
          weekday?: number;
        };
        Relationships: [];
      };
      access_rights: {
        Row: {
          can_edit: boolean;
          can_view: boolean;
          id: string;
          project_id: string;
          role: string | null;
          section_key: string;
          user_id: string | null;
        };
        Insert: {
          can_edit?: boolean;
          can_view?: boolean;
          id?: string;
          project_id: string;
          role?: string | null;
          section_key: string;
          user_id?: string | null;
        };
        Update: {
          can_edit?: boolean;
          can_view?: boolean;
          id?: string;
          project_id?: string;
          role?: string | null;
          section_key?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          id: string;
          project_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          project_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          project_id?: string | null;
        };
        Relationships: [];
      };
      creatives: {
        Row: {
          campaign_id: string | null;
          created_at: string;
          preview_url: string | null;
          status: string | null;
          synced_at: string;
          external_id: string | null;
          id: string;
          name: string;
          platform: string | null;
          project_id: string;
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          preview_url?: string | null;
          status?: string | null;
          synced_at?: string;
          external_id?: string | null;
          id?: string;
          name: string;
          platform?: string | null;
          project_id: string;
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          preview_url?: string | null;
          status?: string | null;
          synced_at?: string;
          external_id?: string | null;
          id?: string;
          name?: string;
          platform?: string | null;
          project_id?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          first_purchase_at: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          project_id: string;
          total_spent: number;
        };
        Insert: {
          created_at?: string;
          first_purchase_at?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          project_id: string;
          total_spent?: number;
        };
        Update: {
          created_at?: string;
          first_purchase_at?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          project_id?: string;
          total_spent?: number;
        };
        Relationships: [];
      };
      employee_reports: {
        Row: {
          author_id: string;
          content: Json | null;
          created_at: string;
          id: string;
          project_id: string;
          report_date: string;
        };
        Insert: {
          author_id: string;
          content?: Json | null;
          created_at?: string;
          id?: string;
          project_id: string;
          report_date: string;
        };
        Update: {
          author_id?: string;
          content?: Json | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          report_date?: string;
        };
        Relationships: [];
      };
      integration_secrets: {
        Row: {
          auth_tag: string;
          ciphertext: string;
          hint: string | null;
          integration_id: string;
          iv: string;
          project_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          auth_tag: string;
          ciphertext: string;
          hint?: string | null;
          integration_id: string;
          iv: string;
          project_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          auth_tag?: string;
          ciphertext?: string;
          hint?: string | null;
          integration_id?: string;
          iv?: string;
          project_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          config: Json | null;
          created_at: string;
          id: string;
          project_id: string;
          provider: string;
          status: string;
        };
        Insert: {
          config?: Json | null;
          created_at?: string;
          id?: string;
          project_id: string;
          provider: string;
          status?: string;
        };
        Update: {
          config?: Json | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          provider?: string;
          status?: string;
        };
        Relationships: [];
      };
      lead_intake: {
        Row: {
          hint: string | null;
          issued_at: string;
          issued_by: string | null;
          last_received_at: string | null;
          project_id: string;
          received_count: number;
          token_hash: string;
        };
        Insert: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id: string;
          received_count?: number;
          token_hash: string;
        };
        Update: {
          hint?: string | null;
          issued_at?: string;
          issued_by?: string | null;
          last_received_at?: string | null;
          project_id?: string;
          received_count?: number;
          token_hash?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          creative_id: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          project_id: string;
          source: string | null;
          status: string;
          value: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          creative_id?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          project_id: string;
          source?: string | null;
          status?: string;
          value?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          creative_id?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          project_id?: string;
          source?: string | null;
          status?: string;
          value?: number | null;
        };
        Relationships: [];
      };
      metrics_daily: {
        Row: {
          ad_spend: number;
          date: string;
          id: string;
          leads: number;
          project_id: string;
          qualified: number;
          revenue: number;
          sales: number;
          trial_lessons: number;
        };
        Insert: {
          ad_spend?: number;
          date: string;
          id?: string;
          leads?: number;
          project_id: string;
          qualified?: number;
          revenue?: number;
          sales?: number;
          trial_lessons?: number;
        };
        Update: {
          ad_spend?: number;
          date?: string;
          id?: string;
          leads?: number;
          project_id?: string;
          qualified?: number;
          revenue?: number;
          sales?: number;
          trial_lessons?: number;
        };
        Relationships: [];
      };
      products: {
        Row: {
          cost_price: number;
          created_at: string;
          id: string;
          low_stock_threshold: number;
          name: string;
          project_id: string;
          sale_price: number;
          sku: string | null;
          stock_quantity: number;
        };
        Insert: {
          cost_price?: number;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name: string;
          project_id: string;
          sale_price?: number;
          sku?: string | null;
          stock_quantity?: number;
        };
        Update: {
          cost_price?: number;
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          name?: string;
          project_id?: string;
          sale_price?: number;
          sku?: string | null;
          stock_quantity?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          global_role: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          global_role?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          global_role?: string;
          id?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          fired_at: string | null;
          hired_at: string;
          id: string;
          project_id: string;
          role: string;
          status: string;
          user_id: string;
        };
        Insert: {
          fired_at?: string | null;
          hired_at?: string;
          id?: string;
          project_id: string;
          role: string;
          status?: string;
          user_id: string;
        };
        Update: {
          fired_at?: string | null;
          hired_at?: string;
          id?: string;
          project_id?: string;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      project_sections: {
        Row: {
          enabled: boolean;
          id: string;
          project_id: string;
          section_key: string;
        };
        Insert: {
          enabled?: boolean;
          id?: string;
          project_id: string;
          section_key: string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          project_id?: string;
          section_key?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          accent_color: string | null;
          ad_spend_rate: number;
          created_at: string;
          currency: string;
          description: string | null;
          director_name: string | null;
          icon: string | null;
          id: string;
          name: string;
          niche: string;
          owner_id: string;
          plan: string;
          status: string;
        };
        Insert: {
          accent_color?: string | null;
          ad_spend_rate?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          director_name?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          niche: string;
          owner_id: string;
          plan?: string;
          status?: string;
        };
        Update: {
          accent_color?: string | null;
          ad_spend_rate?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          director_name?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          niche?: string;
          owner_id?: string;
          plan?: string;
          status?: string;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          created_at: string;
          id: string;
          label: string | null;
          project_id: string;
          type: string;
          value: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string | null;
          project_id: string;
          type: string;
          value?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string | null;
          project_id?: string;
          type?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      returns: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          processed_by: string | null;
          project_id: string;
          reason: string | null;
          sale_id: string | null;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          processed_by?: string | null;
          project_id: string;
          reason?: string | null;
          sale_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          processed_by?: string | null;
          project_id?: string;
          reason?: string | null;
          sale_id?: string | null;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          amount: number;
          created_at: string;
          creative_id: string | null;
          customer_id: string | null;
          id: string;
          lead_id: string | null;
          product: string | null;
          project_id: string;
          seller_id: string | null;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          creative_id?: string | null;
          customer_id?: string | null;
          id?: string;
          lead_id?: string | null;
          product?: string | null;
          project_id: string;
          seller_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          creative_id?: string | null;
          customer_id?: string | null;
          id?: string;
          lead_id?: string | null;
          product?: string | null;
          project_id?: string;
          seller_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      can_view_profile: { Args: { target: string }; Returns: boolean };
      has_project_role: { Args: { pid: string; roles: string[] }; Returns: boolean };
      is_owner: { Args: Record<string, never>; Returns: boolean };
      is_project_member: { Args: { pid: string }; Returns: boolean };
      owns_project: { Args: { pid: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
