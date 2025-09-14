```tsx
import React, { useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { UserPlus, Mail, Lock, User, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import {
  validateUsername,
  validatePhoneNumber, // Not used in this form, but good to keep for consistency if needed
  validateEmail,
  generateUsernameSuggestions,
  UsernameValidationResult
} from '../../utils/usernameValidation';
import { useDebounce } from '../../hooks/useDebounce';

interface EmailValidationResult {
  isValid: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

interface AdminRegisterFormData {
  fullName: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export function AdminRegister() {
  const supabase = useSupabaseClient();
  const session = useSession();

  // Form state
  const [formData, setFormData] = useState<AdminRegisterFormData>({
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  // Validation state
  const [errors, setErrors] = useState<Partial<Record<keyof AdminRegisterFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof AdminRegisterFormData, boolean>>>({});

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

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Debounce username and email for API calls
  const debouncedUsername = useDebounce(formData.username, 500);
  const debouncedEmail = useDebounce(formData.email, 500);

  // Admin check (basic, relies on session email for demo)
  const isAdmin = session?.user?.email?.includes('admin') || false;

  // Handle input changes
  const handleInputChange = (field: keyof AdminRegisterFormData) => (
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

    // Clear global messages
    setGlobalError(null);
    setSuccessMessage(null);
  };

  // Handle field blur
  const handleBlur = (field: keyof AdminRegisterFormData) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  // Validate individual fields
  const validateField = (field: keyof AdminRegisterFormData, value: string) => {
    let error: string | null = null;

    switch (field) {
      case 'fullName':
        if (!value.trim()) {
          error = 'Full name is required';
        } else if (value.trim().split(' ').length < 2) {
          error = 'Please enter full name (first and last name)';
        }
        break;
      case 'email':
        const emailValidation = validateEmail(value);
        error = emailValidation.error;
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
      const normalizedEmail = email.trim().toLowerCase();

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

      if (registrationsResult.error && registrationsResult.error.code !== '42P01') {
        throw registrationsResult.error;
      }

      if (profilesResult.error && profilesResult.error.code !== '42P01') {
        throw profilesResult.error;
      }

      const registrationsCount = registrationsResult.count || 0;
      const profilesCount = profilesResult.count || 0;
      const totalCount = registrationsCount + profilesCount;

      const isAvailable = totalCount === 0;

      setEmailStatus(prev => ({
        ...prev,
        isAvailable,
        error: isAvailable ? null : "This email address is already registered."
      }));

      return isAvailable;

    } catch (error) {
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
  React.useEffect(() => {
    const usernameValidation = validateUsername(debouncedUsername);

    setUsernameStatus(prev => ({
      ...prev,
      isValid: usernameValidation.isValid,
      error: usernameValidation.error
    }));

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
  React.useEffect(() => {
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
    const requiredFields: (keyof AdminRegisterFormData)[] = ['fullName', 'email', 'username', 'password', 'confirmPassword'];

    const hasAllValues = requiredFields.every(field => formData[field].trim());
    const hasNoErrors = Object.values(errors).every(error => !error);
    const isUsernameAvailable = usernameStatus.isValid && usernameStatus.isAvailable === true && !isCheckingUsername;
    const isEmailAvailable = emailStatus.isValid && emailStatus.isAvailable === true && !isCheckingEmail;
    const passwordsMatch = formData.password === formData.confirmPassword && formData.password.length >= 10;

    return hasAllValues && hasNoErrors && isUsernameAvailable && isEmailAvailable && passwordsMatch;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setSuccessMessage(null);

    const allFields: (keyof AdminRegisterFormData)[] = ['fullName', 'email', 'username', 'password', 'confirmPassword'];
    const newTouched = allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);

    allFields.forEach(field => validateField(field, formData[field]));

    const hasBasicErrors = Object.values(errors).some(error => error);
    if (hasBasicErrors) {
      setGlobalError('Please fix the errors above before continuing.');
      return;
    }

    let emailAvailable = false;
    let usernameAvailable = false;

    try {
      setIsSubmitting(true);

      if (formData.email) {
        const emailValidation = validateEmail(formData.email);
        if (emailValidation.isValid) {
          emailAvailable = await checkEmailAvailability(formData.email);
        } else {
          setGlobalError('Please enter a valid email address.');
          setIsSubmitting(false);
          return;
        }
      }

      if (formData.username) {
        const usernameValidation = validateUsername(formData.username);
        if (usernameValidation.isValid) {
          usernameAvailable = await checkUsernameAvailability(formData.username);
        } else {
          setGlobalError('Please enter a valid username.');
          setIsSubmitting(false);
          return;
        }
      }

      if (!emailAvailable) {
        setGlobalError('This email address is already registered.');
        setIsSubmitting(false);
        return;
      }

      if (!usernameAvailable) {
        setGlobalError('This username is already taken.');
        setIsSubmitting(false);
        return;
      }

      // Split fullName into firstName and lastName
      const nameParts = formData.fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Insert into registrations table with 'admin' role
      const { data: newRegistration, error: insertError } = await supabase
        .from('registrations')
        .insert({
          firstName: firstName,
          lastName: lastName,
          email: formData.email.trim().toLowerCase(),
          phone: '', // Phone is optional, not collected on this form
          username: formData.username.trim().toLowerCase(),
          gender: 'Male', // Default gender for admin accounts, can be made selectable
          captureType: 'selfie', // Default, not relevant for admin creation
          imageData: '', // Not relevant for admin creation
          status: 'approved', // Directly approve admin accounts
          password_temp: formData.password,
          role: 'admin' // Set role to admin
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Call approve-and-sync Edge Function
      if (!session?.user?.id) {
        setGlobalError('You must be logged in to perform this action.');
        setIsSubmitting(false);
        return;
      }

      const { data: syncData, error: syncError } = await supabase.functions.invoke('approve-and-sync', {
        body: { registration_id: newRegistration.id },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (syncError) {
        console.error('approve-and-sync function error:', syncError);
        let errorMessage = syncError.message || 'Failed to call approve-and-sync function';
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          errorMessage = 'Not authorized: You must be an admin to approve users';
        }
        throw new Error(`Discourse sync failed: ${errorMessage}`);
      }

      setSuccessMessage(`Admin user "${formData.username}" created and synced to Discourse. They will receive an email to set their password.`);
      setFormData({
        fullName: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: ''
      });
      setErrors({});
      setTouched({});
      setUsernameStatus({ isValid: false, isAvailable: null, error: null, suggestions: [] });
      setEmailStatus({ isValid: false, isAvailable: null, error: null });

    } catch (err: any) {
      console.error('Error creating admin user:', err);
      setGlobalError(`Failed to create admin user: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700">You do not have administrative privileges to view this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="admin-register">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="w-8 h-8 text-[#A3C6E0]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Admin Account</h1>
            <p className="text-gray-600">Provision a new administrator for Tea Time Cari</p>
          </div>

          {globalError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{globalError}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700 text-sm">{successMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
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
                placeholder="e.g., Admin User"
                aria-invalid={errors.fullName && touched.fullName ? 'true' : 'false'}
                disabled={isSubmitting}
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
                  placeholder="e.g., admin@example.com"
                  aria-invalid={(errors.email && touched.email) || emailStatus.error ? 'true' : 'false'}
                  disabled={isSubmitting}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {isCheckingEmail ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : emailStatus.isAvailable === true ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : emailStatus.isAvailable === false ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              </div>
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
                  placeholder="e.g., new_admin"
                  aria-invalid={errors.username && touched.username ? 'true' : 'false'}
                  disabled={isSubmitting}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {isCheckingUsername ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : usernameStatus.isAvailable === true ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : usernameStatus.isAvailable === false ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : null}
                </div>
              </div>
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
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
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
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                isFormValid() && !isSubmitting
                  ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Creating Admin...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Admin Account
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
```