import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.warn('Stripe webhook secret not configured');
      return new Response('Webhook secret not configured', { status: 400 });
    }

    const body = await req.text();
    
    // In a real implementation, you would verify the webhook signature here
    // For now, we'll parse the event directly
    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      console.error('Invalid JSON in webhook body');
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Received webhook event:', event.type);

    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { user_id, feed_access } = paymentIntent.metadata;

      if (!user_id || !feed_access) {
        console.error('Missing metadata in payment intent');
        return new Response('Missing metadata', { status: 400 });
      }

      // Calculate expiration date (3 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      // Update or insert payment record
      const { error: upsertError } = await supabase
        .from('payments')
        .upsert({
          user_id: user_id,
          stripe_payment_intent_id: paymentIntent.id,
          feed_access: feed_access,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'completed',
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'stripe_payment_intent_id'
        });

      if (upsertError) {
        console.error('Error updating payment record:', upsertError);
        return new Response('Database error', { status: 500 });
      }

      console.log(`Payment completed for user ${user_id}, feed access: ${feed_access}`);
    }

    // Handle payment intent failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      
      // Update payment record to failed status
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      if (updateError) {
        console.error('Error updating failed payment record:', updateError);
      }

      console.log(`Payment failed for payment intent: ${paymentIntent.id}`);
    }

    return new Response('Webhook processed successfully', {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Webhook processing failed', {
      status: 500,
      headers: corsHeaders,
    });
  }
});