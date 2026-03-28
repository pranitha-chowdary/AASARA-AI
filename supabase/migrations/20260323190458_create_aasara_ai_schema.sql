/*
  # Aasara AI - Parametric Safety Net Schema

  1. New Tables
    - `gig_workers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `phone_number` (text, unique)
      - `full_name` (text)
      - `onboarding_completed` (boolean, default false)
      - `current_step` (text, default 'platform_linkage')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `platform_linkages`
      - `id` (uuid, primary key)
      - `worker_id` (uuid, references gig_workers)
      - `platform_name` (text) - e.g., 'Zomato', 'Swiggy', 'Zepto', 'Blinkit'
      - `delivery_partner_id` (text)
      - `linked_at` (timestamptz)
      - `is_active` (boolean, default true)
    
    - `subscriptions`
      - `id` (uuid, primary key)
      - `worker_id` (uuid, references gig_workers)
      - `week_start_date` (date)
      - `premium_amount` (numeric)
      - `risk_factors` (jsonb) - stores weather, curfew risk data
      - `payment_status` (text, default 'pending')
      - `payment_id` (text)
      - `created_at` (timestamptz)
    
    - `active_shifts`
      - `id` (uuid, primary key)
      - `worker_id` (uuid, references gig_workers)
      - `is_online` (boolean, default false)
      - `shift_started_at` (timestamptz)
      - `last_location` (jsonb)
      - `updated_at` (timestamptz)
    
    - `admin_users`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, unique)
      - `role` (text, default 'admin')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for admin users to access all data
*/

CREATE TABLE IF NOT EXISTS gig_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text UNIQUE NOT NULL,
  full_name text,
  onboarding_completed boolean DEFAULT false,
  current_step text DEFAULT 'platform_linkage',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_linkages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES gig_workers(id) ON DELETE CASCADE NOT NULL,
  platform_name text NOT NULL,
  delivery_partner_id text NOT NULL,
  linked_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES gig_workers(id) ON DELETE CASCADE NOT NULL,
  week_start_date date NOT NULL,
  premium_amount numeric NOT NULL,
  risk_factors jsonb DEFAULT '{}',
  payment_status text DEFAULT 'pending',
  payment_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES gig_workers(id) ON DELETE CASCADE NOT NULL,
  is_online boolean DEFAULT false,
  shift_started_at timestamptz,
  last_location jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gig_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_linkages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own profile"
  ON gig_workers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Workers can update own profile"
  ON gig_workers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workers can insert own profile"
  ON gig_workers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workers can view own platform linkages"
  ON platform_linkages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = platform_linkages.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can insert own platform linkages"
  ON platform_linkages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = platform_linkages.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = subscriptions.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = subscriptions.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can view own active shifts"
  ON active_shifts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = active_shifts.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can update own active shifts"
  ON active_shifts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = active_shifts.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = active_shifts.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers can insert own active shifts"
  ON active_shifts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gig_workers
      WHERE gig_workers.id = active_shifts.worker_id
      AND gig_workers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all data in gig_workers"
  ON gig_workers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view own profile"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
