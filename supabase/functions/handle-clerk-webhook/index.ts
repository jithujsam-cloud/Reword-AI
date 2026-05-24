import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { Webhook } from "https://esm.sh/svix@1.13.0"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CLERK_WEBHOOK_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  let evt;
  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  const { type, data } = evt;

  if (type === 'user.created') {
    const email = data.email_addresses && data.email_addresses[0] ? data.email_addresses[0].email_address : '';
    const { error } = await supabase.from('users').insert({
      clerk_user_id: data.id,
      email: email,
      plan: 'free',
      rewrites_used: 0,
      rewrites_limit: 3,
      payment_status: 'inactive'
    });
    
    if (error) {
      console.error('Error inserting user:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  } else if (type === 'user.deleted') {
    const { error } = await supabase.from('users').delete().eq('clerk_user_id', data.id);
    if (error) {
      console.error('Error deleting user:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response('OK', { status: 200 });
});
