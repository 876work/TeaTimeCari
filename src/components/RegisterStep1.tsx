import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Check, X, AlertCircle, Loader2, User, Eye, EyeOff, Lock } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { validateEmail, validatePhoneNumber, validateUsername } from '../utils/usernameValidation';

// Updated interface to match Edge Function response
interface UsernameValidationResult {
  isValid: boolean;
  isAvailable: boolean | null;
  error: string | null;
  suggestions: string[];
  isForbidden?: boolean;
}

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
  onBack?: () => void;
  initialData?: RegisterStep1Data;
}

export function RegisterStep1({ onNext, onBack, initialData }: RegisterStep1Props) {
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
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterStep1Data, string | null>>>({});
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
  const getFieldError = (field: keyof RegisterStep1Data, value: string) => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) {
          return 'Full name is required';
        }
        if (value.trim().split(/\s+/).length < 2) {
          return 'Please enter your full name (first and last name)';
        }
        return null;
      case 'email':
        return validateEmail(value).error;
      case 'phone':
        return validatePhoneNumber(value).error;
      case 'username':
        return validateUsername(value).error;
      case 'password':
        if (!value) {
          return 'Password is required';
        }
        if (value.length < 10) {
          return 'Password must be at least 10 characters';
        }
        return null;
      case 'confirmPassword':
        if (!value) {
          return 'Please confirm your password';
        }
        if (value !== formData.password) {
          return 'Passwords do not match';
        }
        return null;
      default:
        return null;
    }
  };

  const validateField = (field: keyof RegisterStep1Data, value: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: getFieldError(field, value)
    }));
  };
  
  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      return false;
    }
    
    setIsCheckingUsername(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-availability', {
        body: { username }
      });
      
      if (error) {
        console.error('Error checking username availability:', error);
        setGlobalError('Failed to check username availability. Please try again.');
        setUsernameStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      
      if (!data.success) {
        console.error('Username availability check failed:', data.error);
        setGlobalError('Failed to check username availability. Please try again.');
        setUsernameStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      
      const usernameResult = data.username;
      if (!usernameResult) {
        throw error;
      }
      
      const isAvailable = usernameResult.isAvailable;
      const suggestions = usernameResult.suggestions || [];
      
      setUsernameStatus(prev => ({
        ...prev,
        isAvailable,
        suggestions,
        isForbidden: usernameResult.isForbidden,
        error: usernameResult.error || null
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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return false;
    }
    
    setIsCheckingEmail(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-availability', {
        body: { email }
      });
      
      if (error) {
        console.error('Error checking email availability:', error);
        setGlobalError('Failed to check email availability. Please try again.');
        setEmailStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      
      if (!data.success) {
        console.error('Email availability check failed:', data.error);
        setGlobalError('Failed to check email availability. Please try again.');
        setEmailStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      
      const emailResult = data.email;
      if (!emailResult) {
        throw new Error('No email result in response');
      }
      
      const isAvailable = emailResult.isAvailable;
      
      console.log('Email availability check:', { 
        email, 
        isAvailable,
        error: emailResult.error
      });
      
      setEmailStatus(prev => ({
        ...prev,
        isAvailable,
        error: emailResult.error || null
      }));
      
      return isAvailable;
      
    } catch (error) {
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
    // Basic client-side validation
    let isValid = true;
    let error: string | null = null;
    
    if (!debouncedUsername) {
      isValid = false;
      error = 'Username is required';
    } else if (debouncedUsername.length < 3) {
      isValid = false;
      error = 'Username must be at least 3 characters';
    } else if (debouncedUsername.length > 20) {
      isValid = false;
      error = 'Username must be 20 characters or less';
    } else if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) {
      isValid = false;
      error = 'Username can only contain letters, numbers, and underscores';
    }
    
    setUsernameStatus(prev => ({
      ...prev,
      isValid,
      error
    }));
    
    // Only check availability if basic validation passes
    if (isValid && debouncedUsername) {
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
    // Basic client-side email validation
    let isValid = true;
    let error: string | null = null;
    
    if (!debouncedEmail) {
      isValid = false;
      error = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail)) {
      isValid = false;
      error = 'Please enter a valid email address';
    }
    
    setEmailStatus(prev => ({
      ...prev,
      isValid,
      error
    }));
    
    // Only check availability if basic validation passes
    if (isValid && debouncedEmail) {
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
  
  const requiredFields: (keyof RegisterStep1Data)[] = ['fullName', 'email', 'phone', 'username', 'password', 'confirmPassword'];

  const getFormErrors = () => {
    return requiredFields.reduce<Partial<Record<keyof RegisterStep1Data, string | null>>>((acc, field) => {
      acc[field] = getFieldError(field, formData[field]);
      return acc;
    }, {});
  };

  // Validate entire form
  const isFormValid = () => {
    const formErrors = getFormErrors();
    
    // Check if all fields have values
    const hasAllValues = requiredFields.every(field => formData[field].trim());
    
    // Check if no errors exist, including errors from the latest field values
    const hasNoErrors = Object.values({ ...errors, ...formErrors }).every(error => !error);
    
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
    const newTouched = requiredFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);
    
    // Validate all fields against the current values synchronously so the first
    // click shows any errors immediately instead of reading stale React state.
    const latestErrors = getFormErrors();
    setErrors(latestErrors);
    
    // Check for basic validation errors first
    const hasBasicErrors = Object.values(latestErrors).some(error => error);
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
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          emailAvailable = await checkEmailAvailability(formData.email);
        } else {
          setGlobalError('Please enter a valid email address.');
          return;
        }
      }
      
      // Check username availability and wait for result
      if (formData.username) {
        if (formData.username.length >= 3 && formData.username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(formData.username)) {
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
      
    } catch (err) {
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
              🔒 Create a secure password - minimum 10 characters for account protection
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
            {touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 && (
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
              <li className={`flex items-center ${formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 ? 'text-green-700' : ''}`}>
                <span className="mr-2">{formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 ? '✅' : '•'}</span>
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
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!isFormValid()}
              className={`${onBack ? 'flex-1' : 'w-full'} py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
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