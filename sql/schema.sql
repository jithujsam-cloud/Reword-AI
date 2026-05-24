-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
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
-- Note: Assuming Clerk JWT is passed to Supabase and 'sub' claim contains clerk_user_id
CREATE POLICY "Users can read own row"
ON users
FOR SELECT
USING (auth.jwt() ->> 'sub' = clerk_user_id);

-- Policy for users to update their own row
CREATE POLICY "Users can update own row"
ON users
FOR UPDATE
USING (auth.jwt() ->> 'sub' = clerk_user_id)
WITH CHECK (auth.jwt() ->> 'sub' = clerk_user_id);
