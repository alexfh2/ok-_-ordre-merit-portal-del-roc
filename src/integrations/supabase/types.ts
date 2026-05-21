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
      course_holes: {
        Row: {
          course_name: string
          created_at: string
          hole_number: number
          id: string
          par: number
          stroke_index: number
          updated_at: string
        }
        Insert: {
          course_name: string
          created_at?: string
          hole_number: number
          id?: string
          par: number
          stroke_index: number
          updated_at?: string
        }
        Update: {
          course_name?: string
          created_at?: string
          hole_number?: number
          id?: string
          par?: number
          stroke_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      historic_hole_scores: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          license_number: string | null
          player_name: string
          round_number: number
          season_id: string
          strokes: number
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          license_number?: string | null
          player_name: string
          round_number: number
          season_id: string
          strokes: number
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          license_number?: string | null
          player_name?: string
          round_number?: number
          season_id?: string
          strokes?: number
        }
        Relationships: []
      }
      historic_rankings: {
        Row: {
          category: string
          id: string
          license_number: string | null
          player_name: string
          position: number
          rounds_played: number
          season_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          category: string
          id?: string
          license_number?: string | null
          player_name: string
          position?: number
          rounds_played?: number
          season_id: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          license_number?: string | null
          player_name?: string
          position?: number
          rounds_played?: number
          season_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historic_rankings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "historic_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      historic_results: {
        Row: {
          created_at: string
          gender: string
          handicap_score: number | null
          id: string
          license_number: string | null
          player_name: string
          round_date: string | null
          round_name: string | null
          round_number: number
          scratch_score: number | null
          season_id: string
        }
        Insert: {
          created_at?: string
          gender?: string
          handicap_score?: number | null
          id?: string
          license_number?: string | null
          player_name: string
          round_date?: string | null
          round_name?: string | null
          round_number: number
          scratch_score?: number | null
          season_id: string
        }
        Update: {
          created_at?: string
          gender?: string
          handicap_score?: number | null
          id?: string
          license_number?: string | null
          player_name?: string
          round_date?: string | null
          round_name?: string | null
          round_number?: number
          scratch_score?: number | null
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historic_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "historic_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      historic_seasons: {
        Row: {
          counting_rounds: number
          created_at: string
          id: string
          modality: string
          status: string
          total_rounds: number
          updated_at: string
          year: number
        }
        Insert: {
          counting_rounds?: number
          created_at?: string
          id?: string
          modality?: string
          status?: string
          total_rounds?: number
          updated_at?: string
          year: number
        }
        Update: {
          counting_rounds?: number
          created_at?: string
          id?: string
          modality?: string
          status?: string
          total_rounds?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      historic_winners: {
        Row: {
          category: string
          created_at: string
          id: string
          photo_url: string | null
          player_name: string
          position: number
          season_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          photo_url?: string | null
          player_name: string
          position: number
          season_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          photo_url?: string | null
          player_name?: string
          position?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historic_winners_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "historic_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      hole_scores: {
        Row: {
          created_at: string
          handicap_points: number | null
          hole_number: number
          id: string
          player_id: string
          scratch_points: number | null
          strokes: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          handicap_points?: number | null
          hole_number: number
          id?: string
          player_id: string
          scratch_points?: number | null
          strokes: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          handicap_points?: number | null
          hole_number?: number
          id?: string
          player_id?: string
          scratch_points?: number | null
          strokes?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hole_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hole_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_hole_scores: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          pair_id: string
          player_name: string | null
          points: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          pair_id: string
          player_name?: string | null
          points?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          pair_id?: string
          player_name?: string | null
          points?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_hole_scores_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pair_hole_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_members: {
        Row: {
          created_at: string
          gender: string
          id: string
          license_number: string | null
          member_order: number
          pair_id: string
          player_name: string
        }
        Insert: {
          created_at?: string
          gender?: string
          id?: string
          license_number?: string | null
          member_order?: number
          pair_id: string
          player_name: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          license_number?: string | null
          member_order?: number
          pair_id?: string
          player_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_members_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_rankings: {
        Row: {
          category: string
          id: string
          pair_id: string
          position: number
          total_points: number
          updated_at: string
        }
        Insert: {
          category: string
          id?: string
          pair_id: string
          position?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          pair_id?: string
          position?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_rankings_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_results: {
        Row: {
          created_at: string
          handicap_score: number | null
          id: string
          pair_id: string
          points: number
          scratch_score: number | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          handicap_score?: number | null
          id?: string
          pair_id: string
          points?: number
          scratch_score?: number | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          handicap_score?: number | null
          id?: string
          pair_id?: string
          points?: number
          scratch_score?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_results_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pair_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      pairs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          birth_date: string | null
          created_at: string
          first_name: string | null
          gender: string
          handicap_actual: number | null
          handicap_updated_at: string | null
          id: string
          is_subscriber: boolean
          last_name: string | null
          license_number: string | null
          name: string
          photo_url: string | null
          subscriber_updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          first_name?: string | null
          gender: string
          handicap_actual?: number | null
          handicap_updated_at?: string | null
          id?: string
          is_subscriber?: boolean
          last_name?: string | null
          license_number?: string | null
          name: string
          photo_url?: string | null
          subscriber_updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          first_name?: string | null
          gender?: string
          handicap_actual?: number | null
          handicap_updated_at?: string | null
          id?: string
          is_subscriber?: boolean
          last_name?: string | null
          license_number?: string | null
          name?: string
          photo_url?: string | null
          subscriber_updated_at?: string | null
        }
        Relationships: []
      }
      rankings: {
        Row: {
          category: string
          id: string
          player_id: string
          position: number
          total_points: number
          updated_at: string
        }
        Insert: {
          category: string
          id?: string
          player_id: string
          position?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          player_id?: string
          position?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          counting_points: number | null
          created_at: string
          handicap_score: number | null
          id: string
          player_id: string
          points: number
          ranking_points: number | null
          scratch_score: number | null
          stableford_handicap_total: number | null
          stableford_scratch_total: number | null
          tournament_id: string
        }
        Insert: {
          counting_points?: number | null
          created_at?: string
          handicap_score?: number | null
          id?: string
          player_id: string
          points?: number
          ranking_points?: number | null
          scratch_score?: number | null
          stableford_handicap_total?: number | null
          stableford_scratch_total?: number | null
          tournament_id: string
        }
        Update: {
          counting_points?: number | null
          created_at?: string
          handicap_score?: number | null
          id?: string
          player_id?: string
          points?: number
          ranking_points?: number | null
          scratch_score?: number | null
          stableford_handicap_total?: number | null
          stableford_scratch_total?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      stableford_hole_scores: {
        Row: {
          created_at: string
          hole_number: number
          id: string
          par: number | null
          player_id: string
          stableford_points: number | null
          stroke_index: number | null
          strokes: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: string
          par?: number | null
          player_id: string
          stableford_points?: number | null
          stroke_index?: number | null
          strokes: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: string
          par?: number | null
          player_id?: string
          stableford_points?: number | null
          stroke_index?: number | null
          strokes?: number
          tournament_id?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string
          date: string | null
          id: string
          is_om: boolean
          name: string
          round_number: number
          season: number
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          is_om?: boolean
          name: string
          round_number: number
          season?: number
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          is_om?: boolean
          name?: string
          round_number?: number
          season?: number
        }
        Relationships: []
      }
    }
    Views: {
      players_public: {
        Row: {
          created_at: string | null
          first_name: string | null
          gender: string | null
          handicap_actual: number | null
          handicap_updated_at: string | null
          id: string | null
          is_subscriber: boolean | null
          last_name: string | null
          license_number: string | null
          name: string | null
          photo_url: string | null
          subscriber_updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          handicap_actual?: number | null
          handicap_updated_at?: string | null
          id?: string | null
          is_subscriber?: boolean | null
          last_name?: string | null
          license_number?: string | null
          name?: string | null
          photo_url?: string | null
          subscriber_updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          handicap_actual?: number | null
          handicap_updated_at?: string | null
          id?: string | null
          is_subscriber?: boolean | null
          last_name?: string | null
          license_number?: string | null
          name?: string | null
          photo_url?: string | null
          subscriber_updated_at?: string | null
        }
        Relationships: []
      }
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
