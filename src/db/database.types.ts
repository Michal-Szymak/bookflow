export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      author_works: {
        Row: {
          author_id: string;
          created_at: string;
          work_id: string;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          work_id: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "author_works_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "author_works_work_id_fkey";
            columns: ["work_id"];
            isOneToOne: false;
            referencedRelation: "works";
            referencedColumns: ["id"];
          },
        ];
      };
      authors: {
        Row: {
          created_at: string;
          id: string;
          manual: boolean;
          name: string;
          ol_expires_at: string | null;
          ol_fetched_at: string | null;
          openlibrary_id: string | null;
          owner_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          manual?: boolean;
          name: string;
          ol_expires_at?: string | null;
          ol_fetched_at?: string | null;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          manual?: boolean;
          name?: string;
          ol_expires_at?: string | null;
          ol_fetched_at?: string | null;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      editions: {
        Row: {
          cover_url: string | null;
          created_at: string;
          id: string;
          isbn13: string | null;
          language: string | null;
          manual: boolean;
          openlibrary_id: string | null;
          owner_user_id: string | null;
          publish_date: string | null;
          publish_date_raw: string | null;
          publish_year: number | null;
          title: string;
          updated_at: string;
          work_id: string;
        };
        Insert: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          isbn13?: string | null;
          language?: string | null;
          manual?: boolean;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          publish_date?: string | null;
          publish_date_raw?: string | null;
          publish_year?: number | null;
          title: string;
          updated_at?: string;
          work_id: string;
        };
        Update: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          isbn13?: string | null;
          language?: string | null;
          manual?: boolean;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          publish_date?: string | null;
          publish_date_raw?: string | null;
          publish_year?: number | null;
          title?: string;
          updated_at?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "editions_work_id_fkey";
            columns: ["work_id"];
            isOneToOne: false;
            referencedRelation: "works";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          author_count: number;
          created_at: string;
          max_authors: number;
          max_works: number;
          updated_at: string;
          user_id: string;
          work_count: number;
        };
        Insert: {
          author_count?: number;
          created_at?: string;
          max_authors?: number;
          max_works?: number;
          updated_at?: string;
          user_id: string;
          work_count?: number;
        };
        Update: {
          author_count?: number;
          created_at?: string;
          max_authors?: number;
          max_works?: number;
          updated_at?: string;
          user_id?: string;
          work_count?: number;
        };
        Relationships: [];
      };
      user_authors: {
        Row: {
          author_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_authors_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
            referencedColumns: ["id"];
          },
        ];
      };
      user_works: {
        Row: {
          available_in_legimi: boolean | null;
          created_at: string;
          status: Database["public"]["Enums"]["user_work_status_enum"];
          status_updated_at: string | null;
          updated_at: string;
          user_id: string;
          work_id: string;
        };
        Insert: {
          available_in_legimi?: boolean | null;
          created_at?: string;
          status?: Database["public"]["Enums"]["user_work_status_enum"];
          status_updated_at?: string | null;
          updated_at?: string;
          user_id: string;
          work_id: string;
        };
        Update: {
          available_in_legimi?: boolean | null;
          created_at?: string;
          status?: Database["public"]["Enums"]["user_work_status_enum"];
          status_updated_at?: string | null;
          updated_at?: string;
          user_id?: string;
          work_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_works_work_id_fkey";
            columns: ["work_id"];
            isOneToOne: false;
            referencedRelation: "works";
            referencedColumns: ["id"];
          },
        ];
      };
      works: {
        Row: {
          created_at: string;
          first_publish_year: number | null;
          id: string;
          manual: boolean;
          openlibrary_id: string | null;
          owner_user_id: string | null;
          primary_edition_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_publish_year?: number | null;
          id?: string;
          manual?: boolean;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          primary_edition_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_publish_year?: number | null;
          id?: string;
          manual?: boolean;
          openlibrary_id?: string | null;
          owner_user_id?: string | null;
          primary_edition_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "works_primary_edition_fk";
            columns: ["primary_edition_id"];
            isOneToOne: false;
            referencedRelation: "editions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      upsert_authors_cache: {
        Args: {
          authors_data: {
            openlibrary_id: string;
            name: string;
            ol_fetched_at: string;
            ol_expires_at: string;
          }[];
        };
        Returns: undefined;
      };
      upsert_work_from_ol: {
        Args: {
          work_data: {
            openlibrary_id: string;
            title: string;
            first_publish_year: number | null;
          };
        };
        Returns: string;
      };
      upsert_edition_from_ol: {
        Args: {
          edition_data: {
            work_id: string;
            openlibrary_id: string;
            title: string;
            publish_year: number | null;
            publish_date: string | null;
            publish_date_raw: string | null;
            isbn13: string | null;
            cover_url: string | null;
            language: string | null;
          };
        };
        Returns: string;
      };
      link_author_work: {
        Args: {
          author_id: string;
          work_id: string;
        };
        Returns: undefined;
      };
      set_primary_edition: {
        Args: {
          work_id: string;
          edition_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_work_status_enum: "to_read" | "in_progress" | "read" | "hidden";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_work_status_enum: ["to_read", "in_progress", "read", "hidden"],
    },
  },
} as const;
