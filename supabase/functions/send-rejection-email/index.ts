import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RequestPayload {
  email: string;
  firstName: string;
  reason: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let userId: string | null = null;
  let deliveryStatus: string = 'failed';
  let errorMessage: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, firstName, reason }: RequestPayload = await req.json();

    // Validate required fields
    if (!email || !firstName || !reason) {
      errorMessage = 'Email, firstName, and reason are required';
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorMessage = 'Invalid email format';
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedFirstName = firstName.trim();
    const sanitizedReason = reason.trim();

    // Get user ID from registrations table
    const { data: userData, error: userError } = await supabase
      .from('registrations')
      .select('id')
      .eq('email', sanitizedEmail)
      .single();

    if (userError) {
      if (userError.code === '42P01') {
        console.warn('Registrations table not found, using mock user ID for demo');
        userId = 'demo-user-id';
      } else if (userError.code === 'PGRST116') {
        errorMessage = 'No registration found with this email address';
        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      } else {
        throw userError;
      }
    } else {
      userId = userData.id;
    }

    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY') || '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';
    const sendGridFromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@code.teatimecari.app';

    if (!sendGridApiKey || sendGridApiKey === 'your-sendgrid-api-key') {
      console.warn('SendGrid API key not configured, simulating email send');
      deliveryStatus = 'simulated';

      // Simulate email sending for development/demo purposes
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Log the simulated send
      if (userId !== 'demo-user-id') {
        try {
          const { error: logError } = await supabase
            .from('code_sends')
            .insert({
              user_id: userId,
              code: null, // No specific code for rejection email
              delivery_status: deliveryStatus,
              error_message: null
            });
          if (logError) console.error('Error logging simulated code send:', logError);
        } catch (logErr) {
          console.error('Critical error logging simulated code send:', logErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email simulated (SendGrid not configured)',
          email: sanitizedEmail
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Compose email content
    const emailSubject = 'Your account has been rejected';
    const emailBody = `Hi ${sanitizedFirstName},

We're sorry, but your account didn't meet our requirements.
Reason: ${sanitizedReason}

If you have questions, reply to this email.

Regards,
The Team`;

    // Send email via SendGrid API
    try {
      const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendGridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [
                {
                  email: sanitizedEmail,
                  name: sanitizedFirstName
                }
              ],
              subject: emailSubject
            }
          ],
          from: {
            email: sendGridFromEmail,
            name: 'Tea Time Cari'
          },
          content: [
            {
              type: 'text/plain',
              value: emailBody
            }
          ]
        }),
      });

      if (!sendGridResponse.ok) {
        const errorData = await sendGridResponse.text();
        console.error('SendGrid API error:', errorData);
        deliveryStatus = 'failed';
        errorMessage = `SendGrid API error: ${sendGridResponse.status} - ${errorData}`;

        // Log the failed send attempt
        if (userId !== 'demo-user-id') {
          try {
            await supabase
              .from('code_sends')
              .insert({
                user_id: userId,
                code: null,
                delivery_status: deliveryStatus,
                error_message: errorMessage
              });
          } catch (logError) {
            console.error('Error logging failed send:', logError);
          }
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: errorMessage
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      console.log('Email sent successfully via SendGrid (rejection)');
      deliveryStatus = 'success';

    } catch (emailError: any) {
      console.error('SendGrid sending error:', emailError);
      deliveryStatus = 'failed';
      errorMessage = `Email sending error: ${emailError.message}`;

      // Log the failed send attempt
      if (userId !== 'demo-user-id') {
        try {
          await supabase
            .from('code_sends')
            .insert({
              user_id: userId,
              code: null,
              delivery_status: deliveryStatus,
              error_message: errorMessage
            });
        } catch (logError) {
          console.error('Error logging failed send:', logError);
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Log the successful send attempt
    if (userId !== 'demo-user-id') {
      try {
        const { error: logError } = await supabase
          .from('code_sends')
          .insert({
            user_id: userId,
            code: null,
            delivery_status: deliveryStatus,
            error_message: null
          });
        if (logError) console.error('Error logging successful send:', logError);
      } catch (logErr) {
        console.error('Critical error logging successful send:', logErr);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rejection email sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Edge Function error:', error);

    // Attempt to log general failure if userId was determined
    if (userId && userId !== 'demo-user-id') {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: logError } = await supabase
          .from('code_sends')
          .insert({
            user_id: userId,
            code: null,
            delivery_status: 'failed',
            error_message: `General function error: ${error.message || String(error)}`
          });
        if (logError) console.error('Error logging general function error:', logError);
      } catch (logErr) {
        console.error('Critical error logging general function error:', logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal Server Error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});