/**
 * Validates if a string is a valid UUID format
 * @param uuid - The string to validate
 * @returns true if the string is a valid UUID, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // UUID v4 regex pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  return uuidRegex.test(uuid);
}

/**
 * Validates if a string is a valid email format
 * @param email - The email string to validate
 * @returns true if the string is a valid email, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string contains a phone number value
 * @param phone - The phone string to validate
 * @returns true if the string contains a phone number value, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  return typeof phone === 'string' && Boolean(phone.trim());
}
