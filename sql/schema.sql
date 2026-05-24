-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id uuid UNIQUE NOT NULL,
  email text NOT NULL,
  plan text DEFAULT 'free',
  rewrites_used integer DEFAULT 0,
  rewrites_limit integer DEFAULT 3,
  payment_status text DEFAULT 'inactive',
  dodo_customer_id text,
  dodo_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service Role Key has full access by default (bypasses RLS), but we can add a policy for clarity
CREATE POLICY "Service Role full access"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy for users to read their own row
CREATE POLICY "Users can read own row"
ON users
FOR SELECT
USING (auth.uid() = supabase_user_id);

-- Policy for users to update their own row
CREATE POLICY "Users can update own row"
ON users
FOR UPDATE
USING (auth.uid() = supabase_user_id)
WITH CHECK (auth.uid() = supabase_user_id);

-- Policy for users to insert their own row
CREATE POLICY "Users can insert own row"
ON users
FOR INSERT
WITH CHECK (auth.uid() = supabase_user_id);
