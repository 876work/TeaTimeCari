import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Check, X, AlertCircle, Loader2, User, Eye, EyeOff, Lock } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { validateEmail, validatePhoneNumber, validateUsername } from '../utils/usernameValidation';

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
  const [formData, setFormData] = useState<RegisterStep1Data>({
    fullName: initialData?.fullName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    confirmPassword: initialData?.confirmPassword || ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegisterStep1Data, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterStep1Data, boolean>>>({});

  const [usernameStatus, setUsernameStatus] = useState<UsernameValidationResult>({
    isValid: false, isAvailable: null, error: null, suggestions: []
  });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [emailStatus, setEmailStatus] = useState<EmailValidationResult>({
    isValid: false, isAvailable: null, error: null
  });
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const debouncedUsername = useDebounce(formData.username, 500);
  const debouncedEmail = useDebounce(formData.email, 500);

  const handleInputChange = (field: keyof RegisterStep1Data) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (field === 'email' && emailStatus.error) setEmailStatus(prev => ({ ...prev, error: null, isAvailable: null }));
    if (globalError) setGlobalError(null);
  };

  const handleBlur = (field: keyof RegisterStep1Data) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const getFieldError = (field: keyof RegisterStep1Data, value: string) => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().split(/\s+/).length < 2) return 'Please enter your full name (first and last name)';
        return null;
      case 'email':
        return validateEmail(value).error;
      case 'phone':
        return validatePhoneNumber(value).error;
      case 'username':
        return validateUsername(value).error;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 10) return 'Password must be at least 10 characters';
        return null;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  };

  const validateField = (field: keyof RegisterStep1Data, value: string) => {
    setErrors(prev => ({ ...prev, [field]: getFieldError(field, value) }));
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) return false;
    setIsCheckingUsername(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-availability', { body: { username } });
      if (error || !data.success) {
        setGlobalError('Failed to check username availability. Please try again.');
        setUsernameStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      const usernameResult = data.username;
      if (!usernameResult) throw error;
      const isAvailable = usernameResult.isAvailable;
      setUsernameStatus(prev => ({
        ...prev, isAvailable, suggestions: usernameResult.suggestions || [],
        isForbidden: usernameResult.isForbidden, error: usernameResult.error || null
      }));
      return isAvailable;
    } catch {
      setGlobalError('Failed to check username availability. Please try again.');
      setUsernameStatus(prev => ({ ...prev, isAvailable: false }));
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    setIsCheckingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-availability', { body: { email } });
      if (error || !data.success) {
        setGlobalError('Failed to check email availability. Please try again.');
        setEmailStatus(prev => ({ ...prev, isAvailable: false }));
        return false;
      }
      const emailResult = data.email;
      if (!emailResult) throw new Error('No email result in response');
      const isAvailable = emailResult.isAvailable;
      setEmailStatus(prev => ({ ...prev, isAvailable, error: emailResult.error || null }));
      return isAvailable;
    } catch {
      setGlobalError('Failed to check email availability. Please try again.');
      setEmailStatus(prev => ({ ...prev, isAvailable: false }));
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  useEffect(() => {
    let isValid = true;
    let error: string | null = null;
    if (!debouncedUsername) { isValid = false; error = 'Username is required'; }
    else if (debouncedUsername.length < 3) { isValid = false; error = 'Username must be at least 3 characters'; }
    else if (debouncedUsername.length > 20) { isValid = false; error = 'Username must be 20 characters or less'; }
    else if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) { isValid = false; error = 'Username can only contain letters, numbers, and underscores'; }
    setUsernameStatus(prev => ({ ...prev, isValid, error }));
    if (isValid && debouncedUsername) {
      checkUsernameAvailability(debouncedUsername);
    } else {
      setUsernameStatus(prev => ({ ...prev, isAvailable: null, suggestions: [] }));
    }
  }, [debouncedUsername]);

  useEffect(() => {
    let isValid = true;
    let error: string | null = null;
    if (!debouncedEmail) { isValid = false; error = 'Email is required'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail)) { isValid = false; error = 'Please enter a valid email address'; }
    setEmailStatus(prev => ({ ...prev, isValid, error }));
    if (isValid && debouncedEmail) {
      checkEmailAvailability(debouncedEmail);
    } else {
      setEmailStatus(prev => ({ ...prev, isAvailable: null }));
    }
  }, [debouncedEmail]);

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

  const isFormValid = () => {
    const formErrors = getFormErrors();
    const hasAllValues = requiredFields.every(field => formData[field].trim());
    const hasNoErrors = Object.values({ ...errors, ...formErrors }).every(error => !error);
    const isUsernameAvailable = usernameStatus.isValid && usernameStatus.isAvailable === true && !isCheckingUsername;
    const isEmailAvailable = emailStatus.isValid && emailStatus.isAvailable === true && !isCheckingEmail;
    const passwordsMatch = formData.password === formData.confirmPassword && formData.password.length >= 10;
    return hasAllValues && hasNoErrors && isUsernameAvailable && isEmailAvailable && passwordsMatch;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    const newTouched = requiredFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);
    const latestErrors = getFormErrors();
    setErrors(latestErrors);
    if (Object.values(latestErrors).some(error => error)) {
      setGlobalError('Please fix the errors above before continuing.');
      return;
    }
    let emailAvailable = false;
    let usernameAvailable = false;
    try {
      if (formData.email) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          emailAvailable = await checkEmailAvailability(formData.email);
        } else {
          setGlobalError('Please enter a valid email address.');
          return;
        }
      }
      if (formData.username) {
        if (formData.username.length >= 3 && formData.username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(formData.username)) {
          usernameAvailable = await checkUsernameAvailability(formData.username);
        } else {
          setGlobalError('Please enter a valid username.');
          return;
        }
      }
      if (!emailAvailable) {
        setGlobalError('This email address is already registered. Please use a different email or try signing in.');
        return;
      }
      if (!usernameAvailable) {
        setGlobalError('This username is already taken. Please choose a different username.');
        return;
      }
      onNext(formData);
    } catch {
      setGlobalError('Failed to verify email and username availability. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="dark-form-box px-10 py-12">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Create Your Account</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Step 1 of 3: Basic Information</p>
        </div>

        {globalError && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className={`form-field ${formData.fullName ? "has-value" : ""}`}>
            <input
              type="text"
              id="s1-fullName"
              value={formData.fullName}
              onChange={handleInputChange('fullName')}
              onBlur={handleBlur('fullName')}
              className={errors.fullName && touched.fullName ? "input-error" : ""}
              aria-invalid={errors.fullName && touched.fullName ? 'true' : 'false'}
            />
            <label htmlFor="s1-fullName">Full Name</label>
            {errors.fullName && touched.fullName && <span className="field-error">{errors.fullName}</span>}
          </div>

          {/* Email */}
          <div className={`form-field ${formData.email ? "has-value" : ""}`}>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                id="s1-email"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                style={{ paddingRight: "2rem" }}
                className={
                  (errors.email && touched.email) || emailStatus.error
                    ? "input-error"
                    : emailStatus.isAvailable === true
                    ? ""
                    : ""
                }
                aria-invalid={(errors.email && touched.email) || emailStatus.error ? 'true' : 'false'}
              />
              <div className="status-icon">
                {isCheckingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
                ) : emailStatus.isAvailable === true ? (
                  <Check className="w-4 h-4" style={{ color: "#6ee7b7" }} />
                ) : emailStatus.isAvailable === false ? (
                  <X className="w-4 h-4" style={{ color: "#E0A3A3" }} />
                ) : null}
              </div>
            </div>
            <label htmlFor="s1-email">Email Address</label>
            {errors.email && touched.email && <span className="field-error">{errors.email}</span>}
            {emailStatus.error && !errors.email && <span className="field-error">{emailStatus.error}</span>}
            {emailStatus.isAvailable === true && !errors.email && <span className="field-success">Email is available</span>}
          </div>

          {/* Phone */}
          <div className={`form-field ${formData.phone ? "has-value" : ""}`}>
            <input
              type="text"
              id="s1-phone"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              onBlur={handleBlur('phone')}
              className={errors.phone && touched.phone ? "input-error" : ""}
              aria-invalid={errors.phone && touched.phone ? 'true' : 'false'}
            />
            <label htmlFor="s1-phone">Phone Number (758-xxx-xxxx)</label>
            {errors.phone && touched.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          {/* Username */}
          <div className={`form-field ${formData.username ? "has-value" : ""}`}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                id="s1-username"
                value={formData.username}
                onChange={handleInputChange('username')}
                onBlur={handleBlur('username')}
                style={{ paddingRight: "2rem" }}
                className={
                  (errors.username && touched.username) || usernameStatus.isAvailable === false
                    ? "input-error"
                    : ""
                }
                aria-invalid={errors.username && touched.username ? 'true' : 'false'}
              />
              <div className="status-icon">
                {isCheckingUsername ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.4)" }} />
                ) : usernameStatus.isAvailable === true ? (
                  <Check className="w-4 h-4" style={{ color: "#6ee7b7" }} />
                ) : usernameStatus.isAvailable === false ? (
                  <X className="w-4 h-4" style={{ color: "#E0A3A3" }} />
                ) : null}
              </div>
            </div>
            <label htmlFor="s1-username">Username (3-20 chars, letters/numbers/_)</label>
            {usernameStatus.error && touched.username && <span className="field-error">{usernameStatus.error}</span>}
            {usernameStatus.isAvailable === true && <span className="field-success">Username is available</span>}
            {usernameStatus.isAvailable === false && (
              <div className="mt-1">
                <span className="field-error">Username is taken</span>
                {usernameStatus.suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Try these:</p>
                    <div className="flex flex-wrap gap-2">
                      {usernameStatus.suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className="px-3 py-1 text-xs rounded-full transition-all"
                          style={{ background: "rgba(163,198,224,0.15)", color: "#A3C6E0", border: "1px solid rgba(163,198,224,0.3)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(163,198,224,0.3)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(163,198,224,0.15)"; }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Password */}
          <div className={`form-field ${formData.password ? "has-value" : ""}`}>
            <div className="input-with-toggle">
              <input
                type={showPassword ? 'text' : 'password'}
                id="s1-password"
                value={formData.password}
                onChange={handleInputChange('password')}
                onBlur={handleBlur('password')}
                required
                autoComplete="new-password"
                minLength={10}
                className={errors.password && touched.password ? "input-error" : ""}
                aria-invalid={errors.password && touched.password ? 'true' : 'false'}
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <label htmlFor="s1-password">Password (min 10 characters)</label>
            {errors.password && touched.password && <span className="field-error">{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div className={`form-field ${formData.confirmPassword ? "has-value" : ""}`}>
            <div className="input-with-toggle">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="s1-confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                required
                autoComplete="new-password"
                minLength={10}
                className={errors.confirmPassword && touched.confirmPassword ? "input-error" : ""}
                aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <label htmlFor="s1-confirmPassword">Confirm Password</label>
            {errors.confirmPassword && touched.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            {touched.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 && (
              <span className="field-success">Passwords match</span>
            )}
          </div>

          {/* Password requirements */}
          <div className="dark-alert-info mb-6">
            <p className="font-medium mb-2 text-sm flex items-center gap-1">
              <Lock className="w-3 h-3" /> Password Requirements
            </p>
            <ul className="space-y-1 text-xs" style={{ color: "rgba(163,198,224,0.7)" }}>
              <li style={{ color: formData.password.length >= 10 ? "#6ee7b7" : undefined }}>
                {formData.password.length >= 10 ? "✓" : "•"} At least 10 characters
              </li>
              <li style={{ color: formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 ? "#6ee7b7" : undefined }}>
                {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 10 ? "✓" : "•"} Passwords must match
              </li>
            </ul>
          </div>

          {/* Buttons */}
          <div className={`flex gap-3 ${onBack ? '' : ''}`}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 px-4 rounded font-medium text-sm transition-colors"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
              >
                Back
              </button>
            )}
            <div className={`${onBack ? 'flex-1' : 'w-full'} text-center`}>
              <button
                type="submit"
                disabled={!isFormValid()}
                className="dark-btn"
                style={{ marginTop: 0 }}
              >
                Next Step
                <span />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
