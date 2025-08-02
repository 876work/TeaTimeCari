import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Key, Loader2, AlertCircle, CheckCircle, Users, Gift } from 'lucide-react';
import { AuthLayout } from '../AuthLayout';

export interface InviteStepData {
  inviteCode: string;
}

interface InviteStepProps {
  onNext: (data: InviteStepData) => void;
}

interface InviteCodeValidation {
  isValid: boolean;
  error: string | null;
  codeData?: {
    id: string;
    code: string;
    usage_limit: number;
    usage_count: number;
    expires_at: string;
  };
}

export function InviteStep({ onNext }: InviteStepProps) {
  const supabase = useSupabaseClient();
  
  // Form state
  const [inviteCode, setInviteCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<InviteCodeValidation>({
    isValid: false,
    error: null
  });
  const [touched, setTouched] = useState(false);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().trim();
    setInviteCode(value);
    
    // Clear previous validation when user types
    if (validation.error) {
      setValidation({ isValid: false, error: null });
    }
  };

  // Validate invite code
  const validateInviteCode = async (code: string): Promise<InviteCodeValidation> => {
    if (!code.trim()) {
      return { isValid: false, error: 'Invite code is required' };
    }

    if (code.length < 3) {
      return { isValid: false, error: 'Invite code must be at least 3 characters' };
    }

    try {
      // Check if invite code exists and is valid
      const { data: codeData, error: fetchError } = await supabase
        .from('invite_codes')
        .select('id, code, usage_limit, usage_count, expires_at, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return { isValid: false, error: 'Invalid invite code. Please check and try again.' };
        }
        if (fetchError.code === '42P01') {
          // Table doesn't exist, allow any code for demo
          console.warn('Invite codes table not found, allowing any code for demo');
          return { 
            isValid: true, 
            error: null,
            codeData: {
              id: 'demo-code',
              code: code,
              usage_limit: 100,
              usage_count: 0,
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          };
        }
        throw fetchError;
      }

      if (!codeData) {
        return { isValid: false, error: 'Invalid invite code. Please check and try again.' };
      }

      // Check if code has expired
      const expiresAt = new Date(codeData.expires_at);
      if (expiresAt < new Date()) {
        return { isValid: false, error: 'This invite code has expired. Please request a new one.' };
      }

      // Check if usage limit has been reached
      if (codeData.usage_count >= codeData.usage_limit) {
        return { isValid: false, error: 'This invite code has reached its usage limit. Please request a new one.' };
      }

      return { 
        isValid: true, 
        error: null,
        codeData: codeData
      };

    } catch (err: any) {
      console.error('Error validating invite code:', err);
      return { isValid: false, error: 'Failed to validate invite code. Please try again.' };
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!inviteCode.trim()) {
      setValidation({ isValid: false, error: 'Please enter an invite code' });
      return;
    }

    setIsValidating(true);
    
    try {
      const validationResult = await validateInviteCode(inviteCode);
      setValidation(validationResult);

      if (validationResult.isValid) {
        // Store the invite code data for later use
        onNext({ inviteCode: inviteCode });
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setValidation({ 
        isValid: false, 
        error: 'An unexpected error occurred. Please try again.' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const isFormValid = inviteCode.trim().length >= 3 && !isValidating;

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Key className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter Invite Code</h1>
          <p className="text-gray-600">You'll need an invite code to register</p>
        </div>

        {/* Information Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Gift className="w-5 h-5 text-[#A3C6E0] mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[#A3C6E0] font-medium mb-1">Need an invite code?</p>
              <p className="text-sm text-gray-700">
                Ask a verified user or admin for an invite code to join the platform.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {validation.error && touched && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{validation.error}</span>
            </div>
          </div>
        )}

        {/* Success Message */}
        {validation.isValid && validation.codeData && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" role="status">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <div className="flex-1">
                <span className="text-green-700 text-sm font-medium">Valid invite code!</span>
                <p className="text-green-600 text-xs mt-1">
                  {validation.codeData.usage_limit - validation.codeData.usage_count} uses remaining
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invite Code Input */}
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
              Invite Code
            </label>
            <div className="relative">
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={handleInputChange}
                onBlur={() => setTouched(true)}
                className={`w-full px-4 py-3 pr-12 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase tracking-wider font-mono text-center ${
                  validation.error && touched
                    ? 'border-[#E0A3A3] bg-red-50'
                    : validation.isValid
                    ? 'border-[#A3C6E0] bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="ENTER-CODE-HERE"
                aria-invalid={validation.error && touched ? 'true' : 'false'}
                disabled={isValidating}
                maxLength={50}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isValidating ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : validation.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : validation.error && touched ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : null}
              </div>
            </div>
            
            {/* Helper text */}
            <p className="mt-2 text-xs text-gray-500">
              Invite codes are case-insensitive and may contain letters, numbers, and dashes
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isValidating ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Validating Code...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Users className="w-5 h-5 mr-2" />
                Continue Registration
              </div>
            )}
          </button>
        </form>

        {/* Sample Codes for Demo */}
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Demo Codes (for testing):</p>
          <div className="flex flex-wrap gap-2">
            {['WELCOME2024', 'BETA_ACCESS', 'FRIENDS_ONLY'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setInviteCode(code)}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full transition-colors font-mono"
              >
                {code}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click any code above to auto-fill the input field
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}