// List of forbidden usernames that cannot be used during registration
const FORBIDDEN_USERNAMES = [
  'admin', 'moderator', 'administrator', 'mod', 'sys', 'system', 'you', 'name', 
  'username', 'user', 'nickname', 'discourse', 'discourseorg', 'discourseforum', 
  'all', 'here', 'info', 'wamil', 'wamil2025', 'wamil1999', 'don', 'vado', 
  'donvado', 'owner', 'root', 'moderators', 'staff', 'team', 'support', 'help', 
  'security', 'abuse', 'webmaster', 'postmaster', 'mailer-daemon', 'no-reply', 
  'noreply', 'contact', 'news', 'updates', 'notices', 'discobot'
];

export interface UsernameValidationResult {
  isValid: boolean;
  isAvailable: boolean | null;
  error: string | null;
  suggestions: string[];
  isForbidden?: boolean;
}

export function validateUsername(username: string): Pick<UsernameValidationResult, 'isValid' | 'error' | 'isForbidden'> {
  if (!username) {
    return { isValid: false, error: 'Username is required', isForbidden: false };
  }
  
  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters', isForbidden: false };
  }
  
  if (username.length > 20) {
    return { isValid: false, error: 'Username must be 20 characters or less', isForbidden: false };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores', isForbidden: false };
  }
  
  // Check if username is forbidden (case-insensitive)
  if (FORBIDDEN_USERNAMES.includes(username.toLowerCase())) {
    return { isValid: true, error: null, isForbidden: true };
  }
  
  return { isValid: true, error: null, isForbidden: false };
}

export function generateUsernameSuggestions(baseUsername: string): string[] {
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

export function validatePhoneNumber(phone: string): { isValid: boolean; error: string | null } {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Phone number is required' };
  }

  return { isValid: true, error: null };
}

export function validateEmail(email: string): { isValid: boolean; error: string | null } {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true, error: null };
}