// Hand-written to match supabase/migrations/0001_initial_schema.sql until a
// live Supabase project exists, shaped to satisfy @supabase/postgrest-js's
// GenericSchema (Row/Insert/Update/Relationships per table, plus Views/
// Functions/Enums/CompositeTypes on the schema). Once you've pushed the
// migrations to your cloud project, regenerate this file from the real
// schema with:
//
//   npx supabase gen types typescript --project-id <your-project-ref> > src/lib/database.types.ts
//
// (find <your-project-ref> in Project Settings > General on the Supabase
// dashboard, or run `npx supabase link` first and use --linked instead).

export type Role = 'employee' | 'admin';
export type PayType = 'hourly' | 'salaried';
export type EmploymentStatus = 'active' | 'inactive';
export type TimeEntrySource = 'self' | 'admin_manual';
export type PtoType = 'pto' | 'sick';
export type PtoStatus = 'pending' | 'approved' | 'denied';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: Role;
          pay_type: PayType;
          hourly_rate: number | null;
          employment_status: EmploymentStatus;
          pto_balance_hours: number;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: Role;
          pay_type?: PayType;
          hourly_rate?: number | null;
          employment_status?: EmploymentStatus;
          pto_balance_hours?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          employee_id: string;
          clock_in: string;
          clock_out: string | null;
          source: TimeEntrySource;
          edited_by: string | null;
          edit_reason: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          clock_in: string;
          clock_out?: string | null;
          source?: TimeEntrySource;
          edited_by?: string | null;
          edit_reason?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'time_entries_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pto_requests: {
        Row: {
          id: string;
          employee_id: string;
          pto_type: PtoType;
          start_date: string;
          end_date: string;
          hours_requested: number;
          status: PtoStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          pto_type: PtoType;
          start_date: string;
          end_date: string;
          hours_requested: number;
          status?: PtoStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['pto_requests']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'pto_requests_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      holidays: {
        Row: {
          id: string;
          name: string;
          holiday_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          holiday_date: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['holidays']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      employee_names: {
        Row: {
          id: string;
          full_name: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      review_pto_request: {
        Args: {
          p_request_id: string;
          p_approve: boolean;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['pto_requests']['Row'];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
