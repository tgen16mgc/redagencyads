export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      workspace_access_requests: {
        Row: {
          email: string;
          full_name: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          note: string | null;
          requested_at: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          email: string;
          full_name?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          note?: string | null;
          requested_at?: string;
          status?: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_access_requests"]["Insert"]>;
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          role: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_invites"]["Insert"]>;
        Relationships: [];
      };
      workspace_login_events: {
        Row: {
          email: string;
          id: number;
          provider: string;
          signed_in_at: string;
          user_agent: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          email: string;
          id?: number;
          provider: string;
          signed_in_at?: string;
          user_agent?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_login_events"]["Insert"]>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          preferences: Json;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          preferences?: Json;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          settings: Json;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          settings?: Json;
          slug: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      record_workspace_login: {
        Args: { p_provider?: string; p_user_agent?: string };
        Returns: number;
      };
      request_workspace_access: {
        Args: { p_email: string; p_full_name?: string; p_note?: string };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
