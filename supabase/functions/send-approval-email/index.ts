import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RequestPayload {
  email: string;
  firstName: string;
  emailCode?: string; // Optional - if not provided, will generate one
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
  let generatedCode: string | null = null;
  let deliveryStatus: string = 'failed';
  let errorMessage: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, firstName, emailCode }: RequestPayload = await req.json();

    // Validate required fields
    if (!email || !firstName) {
      errorMessage = 'Email and firstName are required';
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

    // Get user ID from registrations table
    const { data: userData, error: userError } = await supabase
      .from('registrations')
      .select('id')
      .eq('email', sanitizedEmail)
      .single();

    if (userError) {
      if (userError.code === '42P01') {
        // Table doesn't exist, use mock user ID for demo
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

    // Rate limiting: Check if user has exceeded resend limit (3 attempts per hour)
    if (userId !== 'demo-user-id') {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      try {
        const { data: recentSends, error: countError } = await supabase
          .from('code_sends')
          .select('id')
          .eq('user_id', userId)
          .gte('sent_at', oneHourAgo.toISOString());

        if (countError && countError.code !== '42P01' && countError.code !== 'PGRST116') {
          console.warn('Error checking rate limit:', countError);
          // Continue without rate limiting if we can't check
        } else if (recentSends && recentSends.length >= 3) {
          errorMessage = "You've reached the resend limit. Try again later.";
          
          // Log the rate limit violation
          try {
            await supabase
              .from('code_sends')
              .insert({
                user_id: userId,
                code: 'RATE_LIMITED',
                delivery_status: 'rate_limited',
                error_message: errorMessage
              });
          } catch (logError) {
            console.error('Error logging rate limit violation:', logError);
          }

          return new Response(
            JSON.stringify({ 
              success: false,
              error: errorMessage,
              rateLimited: true
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 429, // Too Many Requests
            }
          );
        }
      } catch (rateLimitError) {
        console.warn('Rate limit check failed, proceeding without limit:', rateLimitError);
        // Continue without rate limiting if check fails
      }
    }

    // Generate or use provided email code
    let finalCode: string;
    if (emailCode) {
      // Validate provided code format (should be SLU + 6 digits)
      if (!/^SLU\d{6}$/.test(emailCode)) {
        errorMessage = 'Invalid email code format. Must be SLU followed by 6 digits.';
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
      finalCode = emailCode;
    } else {
      // Generate new 6-digit code
      const generateSixDigitCode = (): string => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      };
      const sixDigitCode = generateSixDigitCode();
      finalCode = `SLU${sixDigitCode}`;
    }

    generatedCode = finalCode;

    // Calculate expiry time (10 minutes from now)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    // Update the registrations table with the new code and expiry (only if not demo)
    if (userId !== 'demo-user-id') {
      const { data: updateData, error: updateError } = await supabase
        .from('registrations')
        .update({
          email_code: finalCode,
          email_code_expiry: expiryTime.toISOString()
        })
        .eq('email', sanitizedEmail)
        .select('id, email, firstName')
        .single();

      if (updateError) {
        errorMessage = `Failed to update registration record: ${updateError.message}`;
        console.error('Database update error:', updateError);
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

      if (!updateData) {
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
      }
    }

    // Get SendGrid configuration
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
              code: generatedCode,
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
          code: finalCode,
          email: sanitizedEmail
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Compose email content
    const emailSubject = 'Your TeaTimeCari Verification Code';
    const emailBody = `Hi ${sanitizedFirstName},

Your verification code is: ${finalCode}

Use this to activate your account. This code expires in 10 minutes.

Regards,
Tea Time Cari Team`;

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
                code: generatedCode,
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

      // SendGrid returns 202 for successful queuing
      const responseData = await sendGridResponse.text();
      console.log('Email sent successfully via SendGrid:', responseData);
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
              code: generatedCode,
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
            code: generatedCode,
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
        message: 'Verification email sent successfully',
        code: finalCode // Include for debugging/testing purposes
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
            code: generatedCode || 'N/A',
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