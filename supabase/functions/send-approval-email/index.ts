import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RequestPayload {
  email: string;
  firstName: string;
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

    const { email, firstName }: RequestPayload = await req.json();

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

    // Sanitize email (convert to lowercase and trim)
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedFirstName = firstName.trim();

    // Generate 6-digit code
    const generateSixDigitCode = (): string => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const sixDigitCode = generateSixDigitCode();
    const fullCode = `SLU${sixDigitCode}`;
    generatedCode = fullCode;

    // Calculate expiry time (10 minutes from now)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    // Update the registrations table with the new code and expiry
    const { data: updateData, error: updateError } = await supabase
      .from('registrations')
      .update({
        email_code: fullCode,
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

    userId = updateData.id;

    // Check if email service is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@teatimecari.com';

    if (!resendApiKey) {
      console.warn('Resend API key not configured, simulating email send');
      deliveryStatus = 'simulated';
      
      // Simulate email sending for development/demo purposes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the simulated send
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email simulated (Resend not configured)',
          code: fullCode,
          email: sanitizedEmail
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Send email via Resend API
    const emailSubject = 'Your TeaTimeCari Access Code';
    const emailBody = `Hi ${sanitizedFirstName}, your TeaTimeCari access code is: ${fullCode}. Enter this code in the app to complete your access.`;

    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [sanitizedEmail],
          subject: emailSubject,
          text: emailBody,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #A3C6E0; font-size: 28px; margin-bottom: 10px;">TeaTimeCari</h1>
                <p style="color: #666; font-size: 16px;">Your Access Code</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #A3C6E0, #E0A3A3); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px;">
                <h2 style="color: white; font-size: 24px; margin-bottom: 15px;">Hi ${sanitizedFirstName}!</h2>
                <p style="color: white; font-size: 18px; margin-bottom: 20px;">Your TeaTimeCari access code is:</p>
                <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block;">
                  <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 3px;">${fullCode}</span>
                </div>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <p style="color: #666; font-size: 16px; line-height: 1.5;">
                  Enter this code in the app to complete your access.<br>
                  This code will expire in 10 minutes.
                </p>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #A3C6E0;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  <strong>Security Notice:</strong> If you didn't request this code, please ignore this email. 
                  Never share your access code with anyone.
                </p>
              </div>
            </div>
          `
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Resend API error:', errorData);
        deliveryStatus = 'failed';
        errorMessage = `Resend API error: ${resendResponse.status} - ${errorData}`;
      } else {
        const resendData = await resendResponse.json();
        console.log('Email sent successfully via Resend:', resendData.id);
        deliveryStatus = 'success';
      }

    } catch (emailError: any) {
      console.error('Email sending error:', emailError);
      deliveryStatus = 'failed';
      errorMessage = `Email sending error: ${emailError.message}`;
    }

    // Log the code send attempt regardless of email success/failure
    try {
      const { error: logError } = await supabase
        .from('code_sends')
        .insert({
          user_id: userId,
          code: generatedCode,
          delivery_status: deliveryStatus,
          error_message: errorMessage
        });
      if (logError) console.error('Error logging code send:', logError);
    } catch (logErr) {
      console.error('Critical error logging code send:', logErr);
    }

    // Return response based on delivery status
    if (deliveryStatus === 'success') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Approval email sent successfully',
          code: fullCode
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMessage || 'Failed to send email',
          code: fullCode
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

  } catch (error) {
    console.error('Edge Function error:', error);
    
    // Attempt to log general failure if userId was determined
    if (userId) {
      try {
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