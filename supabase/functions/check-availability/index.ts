import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface AvailabilityRequest {
  email?: string;
  username?: string;
}

interface AvailabilityResponse {
  success: boolean;
  email?: {
    isValid: boolean;
    isAvailable: boolean;
    error?: string;
  };
  username?: {
    isValid: boolean;
    isAvailable: boolean;
    isForbidden?: boolean;
    error?: string;
    suggestions?: string[];
  };
  error?: string;
}

// List of forbidden usernames
const FORBIDDEN_USERNAMES = [
  'admin', 'moderator', 'administrator', 'mod', 'sys', 'system', 'you', 'name', 
  'username', 'user', 'nickname', 'discourse', 'discourseorg', 'discourseforum', 
  'all', 'here', 'info', 'wamil', 'wamil2025', 'wamil1999', 'don', 'vado', 
  'donvado', 'owner', 'root', 'moderators', 'staff', 'team', 'support', 'help', 
  'security', 'abuse', 'webmaster', 'postmaster', 'mailer-daemon', 'no-reply', 
  'noreply', 'contact', 'news', 'updates', 'notices', 'discobot'
];

function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

function validateUsername(username: string): { isValid: boolean; isForbidden?: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 20) {
    return { isValid: false, error: 'Username must be 20 characters or less' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  // Check if username is forbidden (case-insensitive)
  if (FORBIDDEN_USERNAMES.includes(username.toLowerCase())) {
    return { isValid: true, isForbidden: true };
  }
  
  return { isValid: true, isForbidden: false };
}

function generateUsernameSuggestions(baseUsername: string): string[] {
  const suggestions: string[] = [];
  const cleanBase = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 17);
  
  // Add random numbers
  for (let i = 0; i < 2; i++) {
    const randomNum = Math.floor(Math.random() * 999) + 1;
    suggestions.push(`${cleanBase}${randomNum}`);
  }
  
  // Add common suffixes
  const suffixes = ['_sl', '_user', '_new'];
  suffixes.forEach(suffix => {
    if (cleanBase.length + suffix.length <= 20) {
      suggestions.push(`${cleanBase}${suffix}`);
    }
  });
  
  // Add year
  const year = new Date().getFullYear().toString().slice(-2);
  if (cleanBase.length + year.length <= 20) {
    suggestions.push(`${cleanBase}${year}`);
  }
  
  return suggestions.slice(0, 5);
}

async function checkEmailAvailability(email: string): Promise<{ isAvailable: boolean; error?: string }> {
  try {
    // Normalize email for consistency
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check both registrations and profiles tables for existing email
    const [registrationsResult, profilesResult] = await Promise.all([
      supabaseAdmin
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail),
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
    ]);
    
    // Handle table not found errors gracefully
    let registrationsCount = 0;
    let profilesCount = 0;
    
    if (registrationsResult.error && registrationsResult.error.code !== '42P01') {
      throw registrationsResult.error;
    } else if (!registrationsResult.error) {
      registrationsCount = registrationsResult.count || 0;
    }
    
    if (profilesResult.error && profilesResult.error.code !== '42P01') {
      throw profilesResult.error;
    } else if (!profilesResult.error) {
      profilesCount = profilesResult.count || 0;
    }
    
    // Calculate total count from both tables
    const totalCount = registrationsCount + profilesCount;
    const isAvailable = totalCount === 0;
    
    return {
      isAvailable,
      error: isAvailable ? undefined : "You're unable to register with this email address. Please use another and try again."
    };
    
  } catch (error: any) {
    console.error('Error checking email availability:', error);
    return {
      isAvailable: false,
      error: 'Failed to check email availability. Please try again.'
    };
  }
}

async function checkUsernameAvailability(username: string): Promise<{ isAvailable: boolean; error?: string; suggestions?: string[] }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      throw error;
    }
    
    const isAvailable = !data;
    const suggestions = isAvailable ? [] : generateUsernameSuggestions(username);
    
    return {
      isAvailable,
      suggestions
    };
    
  } catch (error: any) {
    console.error('Error checking username availability:', error);
    return {
      isAvailable: false,
      error: 'Failed to check username availability. Please try again.'
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    let requestData: AvailabilityRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { email, username } = requestData;
    const response: AvailabilityResponse = { success: true };

    // Validate and check email if provided
    if (email) {
      const emailValidation = validateEmail(email);
      if (emailValidation.isValid) {
        const emailAvailability = await checkEmailAvailability(email);
        response.email = {
          isValid: true,
          isAvailable: emailAvailability.isAvailable,
          error: emailAvailability.error
        };
      } else {
        response.email = {
          isValid: false,
          isAvailable: false,
          error: emailValidation.error
        };
      }
    }

    // Validate and check username if provided
    if (username) {
      const usernameValidation = validateUsername(username);
      if (usernameValidation.isValid) {
        if (usernameValidation.isForbidden) {
          response.username = {
            isValid: true,
            isAvailable: false,
            isForbidden: true,
            suggestions: generateUsernameSuggestions(username)
          };
        } else {
          const usernameAvailability = await checkUsernameAvailability(username);
          response.username = {
            isValid: true,
            isAvailable: usernameAvailability.isAvailable,
            error: usernameAvailability.error,
            suggestions: usernameAvailability.suggestions
          };
        }
      } else {
        response.username = {
          isValid: false,
          isAvailable: false,
          error: usernameValidation.error
        };
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (err: any) {
    console.error("[check-availability] Unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${err?.message || err}`
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});