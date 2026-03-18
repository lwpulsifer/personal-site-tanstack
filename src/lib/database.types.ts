/**
 * Supabase Database type definitions.
 *
 * These types mirror the Supabase generated format. To regenerate from a
 * running Supabase instance, run:
 *
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 *
 * Or, if you have a linked remote project:
 *
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 */

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
      map_events: {
        Row: {
          id: string
          map_slug: string
          location_id: string
          occurred_at: string
          time_zone: string
          notes: string | null
          submitter_name: string | null
          submitter_email: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          map_slug: string
          location_id: string
          occurred_at: string
          time_zone?: string
          notes?: string | null
          submitter_name?: string | null
          submitter_email?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          map_slug?: string
          location_id?: string
          occurred_at?: string
          time_zone?: string
          notes?: string | null
          submitter_name?: string | null
          submitter_email?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'map_events_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'map_locations'
            referencedColumns: ['id']
          },
        ]
      }
      map_locations: {
        Row: {
          id: string
          map_slug: string
          name: string
          description: string | null
          address: string | null
          lat: number
          lng: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          map_slug: string
          name: string
          description?: string | null
          address?: string | null
          lat: number
          lng: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          map_slug?: string
          name?: string
          description?: string | null
          address?: string | null
          lat?: number
          lng?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      map_photos: {
        Row: {
          id: string
          location_id: string | null
          submission_id: string | null
          event_id: string | null
          storage_path: string
          caption: string | null
          exif_lat: number | null
          exif_lng: number | null
          taken_at: string | null
          time_zone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          submission_id?: string | null
          event_id?: string | null
          storage_path: string
          caption?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          taken_at?: string | null
          time_zone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          location_id?: string | null
          submission_id?: string | null
          event_id?: string | null
          storage_path?: string
          caption?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          taken_at?: string | null
          time_zone?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'map_photos_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'map_locations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'map_photos_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'map_submissions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'map_photos_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'map_events'
            referencedColumns: ['id']
          },
        ]
      }
      map_submissions: {
        Row: {
          id: string
          map_slug: string
          location_id: string | null
          proposed_name: string | null
          proposed_lat: number | null
          proposed_lng: number | null
          proposed_address: string | null
          occurred_at: string | null
          time_zone: string | null
          notes: string | null
          submitter_name: string | null
          submitter_email: string | null
          status: Database['public']['Enums']['map_submission_status']
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          map_slug: string
          location_id?: string | null
          proposed_name?: string | null
          proposed_lat?: number | null
          proposed_lng?: number | null
          proposed_address?: string | null
          occurred_at?: string | null
          time_zone?: string | null
          notes?: string | null
          submitter_name?: string | null
          submitter_email?: string | null
          status?: Database['public']['Enums']['map_submission_status']
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          map_slug?: string
          location_id?: string | null
          proposed_name?: string | null
          proposed_lat?: number | null
          proposed_lng?: number | null
          proposed_address?: string | null
          occurred_at?: string | null
          time_zone?: string | null
          notes?: string | null
          submitter_name?: string | null
          submitter_email?: string | null
          status?: Database['public']['Enums']['map_submission_status']
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'map_submissions_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'map_locations'
            referencedColumns: ['id']
          },
        ]
      }
      post_status_update: {
        Row: {
          id: string
          post_id: string
          status: Database['public']['Enums']['post_status']
          changed_at: string
          changed_by: string | null
        }
        Insert: {
          id?: string
          post_id: string
          status: Database['public']['Enums']['post_status']
          changed_at?: string
          changed_by?: string | null
        }
        Update: {
          id?: string
          post_id?: string
          status?: Database['public']['Enums']['post_status']
          changed_at?: string
          changed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'post_status_update_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          content: string
          tags: string[]
          hero_image: string | null
          published_at: string | null
          created_at: string
          updated_at: string
          author_id: string | null
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          content?: string
          tags?: string[]
          hero_image?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
          author_id?: string | null
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string | null
          content?: string
          tags?: string[]
          hero_image?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
          author_id?: string | null
        }
        Relationships: []
      }
      site_views: {
        Row: {
          id: number
          created_at: string | null
          user_ip: string | null
          url: string | null
        }
        Insert: {
          id?: number
          created_at?: string | null
          user_ip?: string | null
          url?: string | null
        }
        Update: {
          id?: number
          created_at?: string | null
          user_ip?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      page_view_counts: {
        Row: {
          url: string | null
          count: number | null
        }
        Relationships: []
      }
      post_current_status: {
        Row: {
          post_id: string | null
          status: Database['public']['Enums']['post_status'] | null
          changed_at: string | null
          changed_by: string | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      map_submission_status: 'pending' | 'approved' | 'rejected'
      post_status: 'PENDING' | 'PUBLISHED' | 'ARCHIVED'
    }
    CompositeTypes: Record<string, never>
  }
}

// ── Convenience helpers ─────────────────────────────────────────────────────

type PublicSchema = Database[Extract<keyof Database, 'public'>]

/** Shorthand for a row type from any public table. */
export type Tables<
  T extends keyof (PublicSchema['Tables'] & PublicSchema['Views']),
> = T extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][T]['Row']
  : T extends keyof PublicSchema['Views']
    ? PublicSchema['Views'][T]['Row']
    : never

/** Shorthand for an insert type from any public table. */
export type TablesInsert<
  T extends keyof PublicSchema['Tables'],
> = PublicSchema['Tables'][T]['Insert']

/** Shorthand for an update type from any public table. */
export type TablesUpdate<
  T extends keyof PublicSchema['Tables'],
> = PublicSchema['Tables'][T]['Update']

/** Shorthand for an enum value from the public schema. */
export type Enums<
  T extends keyof PublicSchema['Enums'],
> = PublicSchema['Enums'][T]
