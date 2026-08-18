export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      map_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          map_slug: string
          notes: string | null
          occurred_at: string
          submitter_email: string | null
          submitter_name: string | null
          time_zone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          map_slug: string
          notes?: string | null
          occurred_at: string
          submitter_email?: string | null
          submitter_name?: string | null
          time_zone?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          map_slug?: string
          notes?: string | null
          occurred_at?: string
          submitter_email?: string | null
          submitter_name?: string | null
          time_zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "map_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      map_locations: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lat: number
          lng: number
          map_slug: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lat: number
          lng: number
          map_slug: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lat?: number
          lng?: number
          map_slug?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string | null
          exif_lat: number | null
          exif_lng: number | null
          id: string
          location_id: string | null
          storage_path: string
          submission_id: string | null
          taken_at: string | null
          time_zone: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          id?: string
          location_id?: string | null
          storage_path: string
          submission_id?: string | null
          taken_at?: string | null
          time_zone?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          id?: string
          location_id?: string | null
          storage_path?: string
          submission_id?: string | null
          taken_at?: string | null
          time_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "map_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_photos_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "map_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_photos_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "map_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_submissions: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          map_slug: string
          notes: string | null
          occurred_at: string | null
          proposed_address: string | null
          proposed_lat: number | null
          proposed_lng: number | null
          proposed_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["map_submission_status"]
          submitter_email: string | null
          submitter_name: string | null
          time_zone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          map_slug: string
          notes?: string | null
          occurred_at?: string | null
          proposed_address?: string | null
          proposed_lat?: number | null
          proposed_lng?: number | null
          proposed_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["map_submission_status"]
          submitter_email?: string | null
          submitter_name?: string | null
          time_zone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          map_slug?: string
          notes?: string | null
          occurred_at?: string | null
          proposed_address?: string | null
          proposed_lat?: number | null
          proposed_lng?: number | null
          proposed_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["map_submission_status"]
          submitter_email?: string | null
          submitter_name?: string | null
          time_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_submissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "map_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_status_update: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          post_id: string
          status: Database["public"]["Enums"]["post_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          post_id: string
          status: Database["public"]["Enums"]["post_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          post_id?: string
          status?: Database["public"]["Enums"]["post_status"]
        }
        Relationships: [
          {
            foreignKeyName: "post_status_update_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          description: string | null
          hero_image: string | null
          id: string
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          description?: string | null
          hero_image?: string | null
          id?: string
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          description?: string | null
          hero_image?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_views: {
        Row: {
          created_at: string | null
          id: number
          url: string | null
          user_ip: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          url?: string | null
          user_ip?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          url?: string | null
          user_ip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      page_view_counts: {
        Row: {
          count: number | null
          url: string | null
        }
        Relationships: []
      }
      post_current_status: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          post_id: string | null
          status: Database["public"]["Enums"]["post_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "post_status_update_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      map_submission_status: "pending" | "approved" | "rejected"
      post_status: "PENDING" | "PUBLISHED" | "ARCHIVED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      map_submission_status: ["pending", "approved", "rejected"],
      post_status: ["PENDING", "PUBLISHED", "ARCHIVED"],
    },
  },
} as const

