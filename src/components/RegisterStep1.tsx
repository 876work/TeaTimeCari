import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Check, X, AlertCircle, Loader2, User, LogIn, Eye, EyeOff, Lock } from 'lucide-react';
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
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
}

interface RegisterStep1Props {
  onNext: (data: RegisterStep1Data) => void;
  initialData?: RegisterStep1Data;
}

export function RegisterStep1({ onNext, initialData }: RegisterStep1Props) {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // Form state
  const [formData, setFormData] = useState<RegisterStep1Data>({
    fullName: initialData?.fullName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    confirmPassword: initialData?.confirmPassword || ''
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
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
      case 'fullName':
        if (!value.trim()) {
          error = 'Full name is required';
        } else if (value.trim().split(' ').length < 2) {
          error = 'Please enter your full name (first and last name)';
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
      case 'password':
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 10) {
          error = 'Password must be at least 10 characters';
        }
        break;
      case 'confirmPassword':
        if (!value) {
          error = 'Please confirm your password';
        } else if (value !== formData.password) {
          error = 'Passwords do not match';
        }
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
      return false;
    }
    
    setIsCheckingUsername(true);
    
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      const isAvailable = !data;
      const suggestions = isAvailable ? [] : generateUsernameSuggestions(username);
      
      setUsernameStatus(prev => ({
        ...prev,
        isAvailable,
        suggestions
      }));
      
      return isAvailable;
      
    } catch (error) {
      console.error('Error checking username availability:', error);
      setGlobalError('Failed to check username availability. Please try again.');
      setUsernameStatus(prev => ({
        ...prev,
        isAvailable: false
      }));
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };
  
  // Check email availability
  const checkEmailAvailability = async (email: string) => {
    if (!email || !validateEmail(email).isValid) {
      return false;
    }
    
    setIsCheckingEmail(true);
    
    try {
      // Normalize email for consistency
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check both registrations and profiles tables for existing email
      const [registrationsResult, profilesResult] = await Promise.all([
        supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('email', normalizedEmail),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('email', normalizedEmail)
      ]);
      
      // Check for errors in either query
      if (registrationsResult.error && registrationsResult.error.code !== '42P01') {
        throw registrationsResult.error;
      }
      
      if (profilesResult.error && profilesResult.error.code !== '42P01') {
        throw profilesResult.error;
      }
      
      // Calculate total count from both tables
      const registrationsCount = registrationsResult.count || 0;
      const profilesCount = profilesResult.count || 0;
      const totalCount = registrationsCount + profilesCount;
      
      const isAvailable = totalCount === 0;
      
      // Debug logging
      console.log('Email availability check:', { 
        email: normalizedEmail, 
        registrationsCount, 
        profilesCount, 
        totalCount, 
        isAvailable 
      });
      
      setEmailStatus(prev => ({
        ...prev,
        isAvailable,
        error: isAvailable ? null : "You're unable to register with this email address. Please use another and try again."
      }));
      
      // Log for debugging
      if (!isAvailable) {
        console.log('Email availability check: Email already exists in database:', normalizedEmail, 'Total count:', totalCount);
      }
      
      return isAvailable;
      
    } catch (error) {
      // Handle table not found errors gracefully for demo purposes
      if (error.code === '42P01') {
        console.warn('Table not found, assuming email is available for demo');
        setEmailStatus(prev => ({
          ...prev,
          isAvailable: true,
          error: null
        }));
        return true;
      }
      
      console.error('Error checking email availability:', error);
      setGlobalError('Failed to check email availability. Please try again.');
      setEmailStatus(prev => ({
        ...prev,
        isAvailable: false
      }));
      return false;
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
    
    // Check if username is forbidden first
    if (usernameValidation.isForbidden) {
      setUsernameStatus(prev => ({
        ...prev,
        isValid: true,
        isAvailable: false,
        error: null,
        suggestions: generateUsernameSuggestions(debouncedUsername)
      }));
    } else if (usernameValidation.isValid && debouncedUsername) {
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
    const requiredFields: (keyof RegisterStep1Data)[] = ['fullName', 'email', 'phone', 'username', 'password', 'confirmPassword'];
    
    // Check if all fields have values
    const hasAllValues = requiredFields.every(field => formData[field].trim());
    
    // Check if no errors exist
    const hasNoErrors = Object.values(errors).every(error => !error);
    
    // Check username availability (must not be checking and must be available)
    const isUsernameAvailable = usernameStatus.isValid && usernameStatus.isAvailable === true && !isCheckingUsername;
    
    // Check email availability (must not be checking and must be available)
    const isEmailAvailable = emailStatus.isValid && emailStatus.isAvailable === true && !isCheckingEmail;
    
    // Check password match
    const passwordsMatch = formData.password === formData.confirmPassword && formData.password.length >= 10;
    
    return hasAllValues && hasNoErrors && isUsernameAvailable && isEmailAvailable && passwordsMatch;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    
    // Mark all fields as touched
    const allFields: (keyof RegisterStep1Data)[] = ['fullName', 'email', 'phone', 'username', 'password', 'confirmPassword'];
    const newTouched = allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);
    
    // Validate all fields
    allFields.forEach(field => validateField(field, formData[field]));
    
    // Check for basic validation errors first
    const hasBasicErrors = Object.values(errors).some(error => error);
    if (hasBasicErrors) {
      setGlobalError('Please fix the errors above before continuing.');
      return;
    }
    
    // Perform synchronous availability checks before submission
    let emailAvailable = false;
    let usernameAvailable = false;
    
    try {
      // Check email availability and wait for result
      if (formData.email) {
        const emailValidation = validateEmail(formData.email);
        if (emailValidation.isValid) {
          emailAvailable = await checkEmailAvailability(formData.email);
        } else {
          setGlobalError('Please enter a valid email address.');
          return;
        }
      }
      
      // Check username availability and wait for result
      if (formData.username) {
        const usernameValidation = validateUsername(formData.username);
        if (usernameValidation.isValid) {
          usernameAvailable = await checkUsernameAvailability(formData.username);
        } else {
          setGlobalError('Please enter a valid username.');
          return;
        }
      }
      
      // Check if email and username are available
      if (!emailAvailable) {
        setGlobalError('This email address is already registered. Please use a different email or try signing in.');
        return;
      }
      
      if (!usernameAvailable) {
        setGlobalError('This username is already taken. Please choose a different username.');
        return;
      }
      
      // All validations passed, proceed to next step
      onNext(formData);
      
    } catch (err: any) {
      console.error('Error during availability check:', err);
      setGlobalError('Failed to verify email and username availability. Please try again.');
      return;
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
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <p className="text-xs text-gray-500 mb-2">
              💡 Enter your first and last name as they appear on your ID
            </p>
            <input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={handleInputChange('fullName')}
              onBlur={handleBlur('fullName')}
              className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.fullName && touched.fullName
                  ? 'border-[#E0A3A3] bg-red-50'
                  : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
              }`}
              placeholder="e.g., John Smith"
              aria-invalid={errors.fullName && touched.fullName ? 'true' : 'false'}
            />
            {errors.fullName && touched.fullName && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.fullName}
              </p>
            )}
          </div>
          
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <p className="text-xs text-gray-500 mb-2">
              📧 We'll use this to send you important updates and verification codes
            </p>
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
                placeholder="e.g., john@example.com"
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
            <p className="text-xs text-gray-500 mb-2">
              📱 Saint Lucia format required - we may send verification codes here
            </p>
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
              placeholder="758-123-4567 or 7581234567"
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
            <p className="text-xs text-gray-500 mb-2">
              🏷️ Choose a unique name - letters, numbers, and underscores only (3-20 characters)
            </p>
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
                placeholder="e.g., john_smith or johnsmith123"
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
          
          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <p className="text-xs text-gray-500 mb-2">
              🔒 Create a secure password - minimum 6 characters for account protection
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.password && touched.password
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Create a secure password"
                required
                autoComplete="new-password"
                minLength={10}
                aria-invalid={errors.password && touched.password ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {errors.password && touched.password && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <p className="text-xs text-gray-500 mb-2">
              🔄 Re-enter your password to make sure it's correct
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.confirmPassword && touched.confirmPassword
                    ? 'border-[#E0A3A3] bg-red-50'
                    : touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword
                    ? 'border-[#A3C6E0] bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="Type your password again"
                required
                autoComplete="new-password"
                minLength={10}
                aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {errors.confirmPassword && touched.confirmPassword && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.confirmPassword}
              </p>
            )}
            {touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 && (
              <p className="mt-2 text-sm text-green-600" role="status">
                ✅ Passwords match
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-3 flex items-center">
              <span className="mr-2">🛡️</span>
              Password Security Requirements:
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li className={`flex items-center ${formData.password.length >= 10 ? 'text-green-700' : ''}`}>
                <span className="mr-2">{formData.password.length >= 10 ? '✅' : '•'}</span>
                At least 10 characters long
              </li>
              <li className={`flex items-center ${formData.password && formData.confirmPassword && formData.password === formData.confirmPassword ? 'text-green-700' : ''}`}>
                <span className="mr-2">{formData.password && formData.confirmPassword && formData.password === formData.confirmPassword ? '✅' : '•'}</span>
                Passwords must match
              </li>
              <li className="flex items-center text-blue-600">
                <span className="mr-2">💡</span>
                <span className="text-xs">Tip: Use a mix of letters, numbers, and symbols for better security</span>
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={!isFormValid()}
              className="w-full py-3 px-4 rounded-lg font-medium transition-all ${
                isFormValid()
                  ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              } transition-all duration-200"
            >
              Next Step
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}