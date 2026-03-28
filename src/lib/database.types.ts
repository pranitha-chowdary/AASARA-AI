export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      gig_workers: {
        Row: {
          id: string
          user_id: string | null
          phone_number: string
          full_name: string | null
          onboarding_completed: boolean
          current_step: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          phone_number: string
          full_name?: string | null
          onboarding_completed?: boolean
          current_step?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          phone_number?: string
          full_name?: string | null
          onboarding_completed?: boolean
          current_step?: string
          created_at?: string
          updated_at?: string
        }
      }
      platform_linkages: {
        Row: {
          id: string
          worker_id: string
          platform_name: string
          delivery_partner_id: string
          linked_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          worker_id: string
          platform_name: string
          delivery_partner_id: string
          linked_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          worker_id?: string
          platform_name?: string
          delivery_partner_id?: string
          linked_at?: string
          is_active?: boolean
        }
      }
      subscriptions: {
        Row: {
          id: string
          worker_id: string
          week_start_date: string
          premium_amount: number
          risk_factors: Json
          payment_status: string
          payment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          worker_id: string
          week_start_date: string
          premium_amount: number
          risk_factors?: Json
          payment_status?: string
          payment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          worker_id?: string
          week_start_date?: string
          premium_amount?: number
          risk_factors?: Json
          payment_status?: string
          payment_id?: string | null
          created_at?: string
        }
      }
      active_shifts: {
        Row: {
          id: string
          worker_id: string
          is_online: boolean
          shift_started_at: string | null
          last_location: Json | null
          updated_at: string
        }
        Insert: {
          id?: string
          worker_id: string
          is_online?: boolean
          shift_started_at?: string | null
          last_location?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          worker_id?: string
          is_online?: boolean
          shift_started_at?: string | null
          last_location?: Json | null
          updated_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          user_id: string | null
          email: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          role?: string
          created_at?: string
        }
      }
    }
  }
}
