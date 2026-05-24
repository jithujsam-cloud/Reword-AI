import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { Webhook } from "https://esm.sh/svix@1.13.0"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DODO_WEBHOOK_SECRET = Deno.env.get('DODO_WEBHOOK_SECRET') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const wh = new Webhook(DODO_WEBHOOK_SECRET);
  let evt;
  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  const { type, data } = evt;

  try {
    if (type === 'payment.succeeded') {
      const email = data.customer.email;
      const { error } = await supabase.from('users').update({
        plan: 'pro',
        payment_status: 'active',
        rewrites_limit: 999999,
        dodo_customer_id: data.customer.customer_id,
        dodo_subscription_id: data.subscription_id
      }).eq('email', email);

      if (error) throw error;
    } 
    else if (type === 'subscription.cancelled') {
      const { error } = await supabase.from('users').update({
        plan: 'free',
        payment_status: 'cancelled',
        rewrites_limit: 3,
        rewrites_used: 0
      }).eq('dodo_subscription_id', data.subscription_id);

      if (error) throw error;
    }
    else if (type === 'payment.failed') {
      const { error } = await supabase.from('users').update({
        payment_status: 'failed'
      }).eq('dodo_subscription_id', data.subscription_id);

      if (error) throw error;
    }
    else if (type === 'subscription.renewed') {
      const { error } = await supabase.from('users').update({
        plan: 'pro',
        payment_status: 'active'
      }).eq('dodo_subscription_id', data.subscription_id);

      if (error) throw error;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error processing Dodo webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
