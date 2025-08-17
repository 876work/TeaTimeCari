import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Check, X, AlertCircle, Loader2, User, LogIn } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import {
  validateUsername,
  generateUsernameSuggestions,
  validatePhoneNumber,
  validateEmail,
  UsernameValidationResult
} from '../utils/usernameValidation';

interface EmailValidationResult {
  isValid: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

export interface RegisterStep1Data {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
}

interface RegisterStep1Props {
  onNext: (data: RegisterStep1Data) => void;
  onGoToLogin?: () => void;
  initialData?: RegisterStep1Data;
}

export function RegisterStep1({ onNext, onGoToLogin, initialData }: RegisterStep1Props) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // Form state
  const [formData, setFormData] = useState<RegisterStep1Data>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    username: initialData?.username || ''
  });
  
  // Validation state
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterStep1Data, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterStep1Data, boolean>>>({});
  
  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<UsernameValidationResult>({
    isValid: false,
    isAvailable: null,
    error: null,
    suggestions: []
  });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  
  // Email validation state
  const [emailStatus, setEmailStatus] = useState<EmailValidationResult>({
    isValid: false,
    isAvailable: null,
    error: null
  });
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  
  // Global error state
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Debounce username for API calls
  const debouncedUsername = useDebounce(formData.username, 500);
  
  // Debounce email for API calls
  const debouncedEmail = useDebounce(formData.email, 500);
  
  // Handle input changes
  const handleInputChange = (field: keyof RegisterStep1Data) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear previous errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear email validation when user starts typing
    if (field === 'email' && emailStatus.error) {
      setEmailStatus(prev => ({ ...prev, error: null, isAvailable: null }));
    }
    
    // Clear global error
    if (globalError) {
      setGlobalError(null);
    }
  };
  
  // Handle field blur
  const handleBlur = (field: keyof RegisterStep1Data) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };
  
  // Validate individual fields
  const validateField = (field: keyof RegisterStep1Data, value: string) => {
    let error: string | null = null;
    
    switch (field) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) {
          error = `${field === 'firstName' ? 'First' : 'Last'} name is required`;
        }
        break;
      case 'email':
        const emailValidation = validateEmail(value);
        error = emailValidation.error;
        break;
      case 'phone':
        const phoneValidation = validatePhoneNumber(value);
        error = phoneValidation.error;
        break;
      case 'username':
        const usernameValidation = validateUsername(value);
        error = usernameValidation.error;
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };
  
  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || !validateUsername(username).isValid) {
      return;
    }
    
    setIsCheckingUsername(true);
    
    try {
      // Check if username exists in a users table
      // Note: This assumes you have a users table with a username column
      const { data, error } = await supabase
        .from('registrations')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }
      
      const isAvailable = !data;
      const suggestions = isAvailable ? [] : generateUsernameSuggestions(username);
      
      setUsernameStatus(prev => ({
        ...prev,
        isAvailable,
        suggestions
      }));
      
    } catch (error) {
      console.error('Error checking username availability:', error);
      setGlobalError('Failed to check username availability. Please try again.');
    } finally {
      setIsCheckingUsername(false);
    }
  };
  
  // Check email availability
  const checkEmailAvailability = async (email: string) => {
    if (!email || !validateEmail(email).isValid) {
      return;
    }
    
    setIsCheckingEmail(true);
    
    try {
      // Check if email exists in registrations table
      const { data, error } = await supabase
        .from('registrations')
        .select('email')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        if (error.code === '42P01') {
          // Table doesn't exist, assume email is available for demo
          console.warn('Registrations table not found, assuming email is available for demo');
          setEmailStatus(prev => ({
            ...prev,
            isAvailable: true,
            error: null
          }));
          return;
        }
        throw error;
      }
      
      const isAvailable = !data;
      
      setEmailStatus(prev => ({
        ...prev,
        isAvailable,
        error: isAvailable ? null : "You're unable to register with this email address. Please use another and try again."
      }));
      
      // Log for debugging
      if (!isAvailable) {
        console.log('Email availability check: Email already exists in database:', email);
      }
      
    } catch (error) {
      console.error('Error checking email availability:', error);
      setGlobalError('Failed to check email availability. Please try again.');
    } finally {
      setIsCheckingEmail(false);
    }
  };
  
  // Effect for username availability checking
  useEffect(() => {
    const usernameValidation = validateUsername(debouncedUsername);
    
    setUsernameStatus(prev => ({
      ...prev,
      isValid: usernameValidation.isValid,
      error: usernameValidation.error
    }));
    
    if (usernameValidation.isValid && debouncedUsername) {
      checkUsernameAvailability(debouncedUsername);
    } else {
      setUsernameStatus(prev => ({
        ...prev,
        isAvailable: null,
        suggestions: []
      }));
    }
  }, [debouncedUsername]);
  
  // Effect for email availability checking
  useEffect(() => {
    const emailValidation = validateEmail(debouncedEmail);
    
    setEmailStatus(prev => ({
      ...prev,
      isValid: emailValidation.isValid,
      error: emailValidation.error
    }));
    
    if (emailValidation.isValid && debouncedEmail) {
      checkEmailAvailability(debouncedEmail);
    } else {
      setEmailStatus(prev => ({
        ...prev,
        isAvailable: null
      }));
    }
  }, [debouncedEmail]);
  
  // Handle username suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setFormData(prev => ({ ...prev, username: suggestion }));
  };
  
  // Validate entire form
  const isFormValid = () => {
    const requiredFields: (keyof RegisterStep1Data)[] = ['firstName', 'lastName', 'email', 'phone', 'username'];
    
    // Check if all fields have values
    const hasAllValues = requiredFields.every(field => formData[field].trim());
    
    // Check if no errors exist
    const hasNoErrors = Object.values(errors).every(error => !error);
    
    // Check username availability
    const isUsernameAvailable = usernameStatus.isValid && usernameStatus.isAvailable === true;
    
    // Check email availability
    const isEmailAvailable = emailStatus.isValid && emailStatus.isAvailable === true;
    
    return hasAllValues && hasNoErrors && isUsernameAvailable && isEmailAvailable;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allFields: (keyof RegisterStep1Data)[] = ['firstName', 'lastName', 'email', 'phone', 'username'];
    const newTouched = allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);
    
    // Validate all fields
    allFields.forEach(field => validateField(field, formData[field]));
    
    // Perform immediate re-check of email and username availability before submission
    setGlobalError(null);
    
    try {
      // Re-check email availability
      if (formData.email) {
        const emailValidation = validateEmail(formData.email);
        if (emailValidation.isValid) {
          await checkEmailAvailability(formData.email);
        }
      }
      
      // Re-check username availability
      if (formData.username) {
        const usernameValidation = validateUsername(formData.username);
        if (usernameValidation.isValid) {
          await checkUsernameAvailability(formData.username);
        }
      }
      
      // Wait a moment for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err: any) {
      console.error('Error during final availability check:', err);
      setGlobalError('Failed to verify availability. Please try again.');
      return;
    }
    
    // Re-validate form after the immediate checks
    if (isFormValid()) {
      onNext(formData);
    } else {
      // If form is no longer valid after re-check, show appropriate error
      if (emailStatus.error) {
        setGlobalError(emailStatus.error);
      } else if (!usernameStatus.isAvailable) {
        setGlobalError('Username is no longer available. Please choose a different username.');
      } else {
        setGlobalError('Please fix the errors above before continuing.');
      }
    }
  };
  
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">Step 1 of 3: Basic Information</p>
        </div>
        
        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{globalError}</span>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              value={formData.firstName}
              onChange={handleInputChange('firstName')}
              onBlur={handleBlur('firstName')}
              className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.firstName && touched.firstName
                  ? 'border-[#E0A3A3] bg-red-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="Enter your first name"
              aria-invalid={errors.firstName && touched.firstName ? 'true' : 'false'}
            />
            {errors.firstName && touched.firstName && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.firstName}
              </p>
            )}
          </div>
          
          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              value={formData.lastName}
              onChange={handleInputChange('lastName')}
              onBlur={handleBlur('lastName')}
              className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.lastName && touched.lastName
                  ? 'border-[#E0A3A3] bg-red-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="Enter your last name"
              aria-invalid={errors.lastName && touched.lastName ? 'true' : 'false'}
            />
            {errors.lastName && touched.lastName && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.lastName}
              </p>
            )}
          </div>
          
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                className={`w-full px-4 py-3 pr-12 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  (errors.email && touched.email) || emailStatus.error
                    ? 'border-[#E0A3A3] bg-red-50'
                    : emailStatus.isAvailable === true
                    ? 'border-[#A3C6E0] bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Enter your email address"
                aria-invalid={(errors.email && touched.email) || emailStatus.error ? 'true' : 'false'}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isCheckingEmail ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : emailStatus.isAvailable === true ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : emailStatus.isAvailable === false ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null}
              </div>
            </div>
            
            {/* Email validation messages */}
            {errors.email && touched.email && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.email}
              </p>
            )}
            
            {emailStatus.error && !errors.email && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {emailStatus.error}
              </p>
            )}
            
            {emailStatus.isAvailable === true && !errors.email && (
              <p className="mt-2 text-sm text-green-600" role="status">
                ✅ Email is available
              </p>
            )}
          </div>
          
          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              id="phone"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              onBlur={handleBlur('phone')}
              className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.phone && touched.phone
                  ? 'border-[#E0A3A3] bg-red-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="758xxxxxxx"
              aria-invalid={errors.phone && touched.phone ? 'true' : 'false'}
            />
            {errors.phone && touched.phone && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.phone}
              </p>
            )}
          </div>
          
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={handleInputChange('username')}
                onBlur={handleBlur('username')}
                className={`w-full px-4 py-3 pr-12 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.username && touched.username
                    ? 'border-[#E0A3A3] bg-red-50'
                    : usernameStatus.isAvailable === true
                    ? 'border-[#A3C6E0] bg-blue-50'
                    : usernameStatus.isAvailable === false
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Choose a username"
                aria-invalid={errors.username && touched.username ? 'true' : 'false'}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {isCheckingUsername ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : usernameStatus.isAvailable === true ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : usernameStatus.isAvailable === false ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null}
              </div>
            </div>
            
            {/* Username status messages */}
            {usernameStatus.error && touched.username && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {usernameStatus.error}
              </p>
            )}
            
            {usernameStatus.isAvailable === true && (
              <p className="mt-2 text-sm text-green-600" role="status">
                ✅ Username is available
              </p>
            )}
            
            {usernameStatus.isAvailable === false && (
              <div className="mt-2">
                <p className="text-sm text-red-600 mb-2" role="alert">
                  ❌ Username is taken
                </p>
                {usernameStatus.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Try these suggestions:</p>
                    <div className="flex flex-wrap gap-2">
                      {usernameStatus.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-3 py-1 text-xs bg-[#A3C6E0] bg-opacity-30 hover:bg-[#A3C6E0] hover:bg-opacity-50 text-blue-700 rounded-full transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Submit Button */}
          <div className="flex space-x-4">
            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign In Instead
              </button>
            )}
            <button
              type="submit"
              disabled={!isFormValid()}
              className={`${onGoToLogin ? 'flex-1' : 'w-full'} py-3 px-4 rounded-lg font-medium transition-all ${
                isFormValid()
                  ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next Step
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}