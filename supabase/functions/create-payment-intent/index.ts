import { createClient } from 'npm:@supabase/supabase-js@2';
import { isFeatureEnabled } from '../_shared/featureFlags.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RequestPayload {
  feedAccess: string;
  amount: number;
  currency: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!(await isFeatureEnabled('premium_purchases_enabled'))) {
      return new Response(
        JSON.stringify({ error: 'Premium purchases are temporarily unavailable. Please try again later.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const { feedAccess, amount, currency }: RequestPayload = await req.json();

    if (!feedAccess || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: feedAccess, amount, currency' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Check if Stripe is configured
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.warn('Stripe not configured, returning mock payment intent');
      
      // Return mock payment intent for development
      const mockPaymentIntent = {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_${Date.now()}_secret_mock`,
        amount: amount,
        currency: currency,
        status: 'requires_payment_method'
      };

      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentIntent: mockPaymentIntent,
          message: 'Mock payment intent created (Stripe not configured)'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Create Stripe payment intent
    const stripeUrl = 'https://api.stripe.com/v1/payment_intents';
    let paymentIntent;
    
    try {
      const stripeResponse = await fetch(stripeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          amount: amount.toString(),
          currency: currency,
          metadata: JSON.stringify({
            user_id: user.id,
            feed_access: feedAccess,
          }),
        }),
      });

      if (!stripeResponse.ok) {
        const errorData = await stripeResponse.text();
        console.error('Stripe API error:', errorData);
        throw new Error(`Stripe API error: ${stripeResponse.status} - ${errorData}`);
      }

      paymentIntent = await stripeResponse.json();
    } catch (fetchError) {
      console.error('Failed to connect to Stripe API:', fetchError);
      throw new Error(`Failed to connect to Stripe API: ${String(fetchError)}`);
    }

    // Store pending payment record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // 3 days from now

    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        feed_access: feedAccess,
        amount: amount,
        currency: currency,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error storing payment record:', insertError);
      // Don't fail the request if we can't store the record initially
      // The webhook will handle creating/updating the record
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Edge Function error:', String(error));
    return new Response(
      JSON.stringify({ 
        error: String(error) || 'Internal Server Error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});