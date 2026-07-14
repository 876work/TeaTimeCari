import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Check,
  X,
  AlertCircle,
  Loader2,
  User,
  Eye,
  EyeOff,
  Lock,
  HelpCircle,
} from "lucide-react";
import { RegistrationProgress } from "./Register/RegistrationProgress";
import { useDebounce } from "../hooks/useDebounce";
import {
  validateEmail,
  validatePhoneNumber,
  validateUsername,
} from "../utils/usernameValidation";
import { debugError, debugLog } from "@/lib/debugLogger";

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

export function RegisterStep1({
  onNext,
  onBack,
  initialData,
}: RegisterStep1Props) {
  const [formData, setFormData] = useState<RegisterStep1Data>({
    fullName: initialData?.fullName || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    username: initialData?.username || "",
    password: initialData?.password || "",
    confirmPassword: initialData?.confirmPassword || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterStep1Data, string | null>>
  >({});

  const [touched, setTouched] = useState<
    Partial<Record<keyof RegisterStep1Data, boolean>>
  >({});

  const [usernameStatus, setUsernameStatus] =
    useState<UsernameValidationResult>({
      isValid: false,
      isAvailable: null,
      error: null,
      suggestions: [],
    });

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [emailStatus, setEmailStatus] = useState<EmailValidationResult>({
    isValid: false,
    isAvailable: null,
    error: null,
  });

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeHelpField, setActiveHelpField] =
    useState<keyof RegisterStep1Data | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const debouncedUsername = useDebounce(formData.username, 500);
  const debouncedEmail = useDebounce(formData.email, 500);

  const handleInputChange =
    (field: keyof RegisterStep1Data) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      if (field === "email" && emailStatus.error) {
        setEmailStatus((prev) => ({
          ...prev,
          error: null,
          isAvailable: null,
        }));
      }

      if (globalError) {
        setGlobalError(null);
      }
    };

  const handleBlur = (field: keyof RegisterStep1Data) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(field, formData[field]);
  };

  const getFieldError = (field: keyof RegisterStep1Data, value: string) => {
    switch (field) {
      case "fullName":
        if (!value.trim()) return "Full name is required";
        if (value.trim().split(/\s+/).length < 2) {
          return "Please enter your full name (first and last name)";
        }
        return null;

      case "email":
        return validateEmail(value).error;

      case "phone":
        return validatePhoneNumber(value).error;

      case "username":
        return validateUsername(value).error;

      case "password":
        if (!value) return "Password is required";
        if (value.length < 10) return "Password must be at least 10 characters";
        return null;

      case "confirmPassword":
        if (!value) return "Please confirm your password";
        if (value !== formData.password) return "Passwords do not match";
        return null;

      default:
        return null;
    }
  };

  const validateField = (field: keyof RegisterStep1Data, value: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: getFieldError(field, value),
    }));
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      return false;
    }

    setIsCheckingUsername(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "check-availability",
        {
          body: { username },
        }
      );

      if (error) {
        debugError("Error checking username availability:", error);
        setGlobalError("Failed to check username availability. Please try again.");
        setUsernameStatus((prev) => ({ ...prev, isAvailable: false }));
        return false;
      }

      if (!data.success) {
        debugError("Username availability check failed:", data.error);
        setGlobalError("Failed to check username availability. Please try again.");
        setUsernameStatus((prev) => ({ ...prev, isAvailable: false }));
        return false;
      }

      const usernameResult = data.username;

      if (!usernameResult) {
        throw new Error("No username result in response");
      }

      const isAvailable = usernameResult.isAvailable;
      const suggestions = usernameResult.suggestions || [];

      setUsernameStatus((prev) => ({
        ...prev,
        isAvailable,
        suggestions,
        isForbidden: usernameResult.isForbidden,
        error: usernameResult.error || null,
      }));

      return isAvailable;
    } catch (error) {
      debugError("Error checking username availability:", error);
      setGlobalError("Failed to check username availability. Please try again.");
      setUsernameStatus((prev) => ({
        ...prev,
        isAvailable: false,
      }));
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return false;
    }

    setIsCheckingEmail(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "check-availability",
        {
          body: { email },
        }
      );

      if (error) {
        debugError("Error checking email availability:", error);
        setGlobalError("Failed to check email availability. Please try again.");
        setEmailStatus((prev) => ({ ...prev, isAvailable: false }));
        return false;
      }

      if (!data.success) {
        debugError("Email availability check failed:", data.error);
        setGlobalError("Failed to check email availability. Please try again.");
        setEmailStatus((prev) => ({ ...prev, isAvailable: false }));
        return false;
      }

      const emailResult = data.email;

      if (!emailResult) {
        throw new Error("No email result in response");
      }

      const isAvailable = emailResult.isAvailable;

      debugLog("Email availability check:", {
        email,
        isAvailable,
        error: emailResult.error,
      });

      setEmailStatus((prev) => ({
        ...prev,
        isAvailable,
        error: emailResult.error || null,
      }));

      return isAvailable;
    } catch (error) {
      debugError("Error checking email availability:", error);
      setGlobalError("Failed to check email availability. Please try again.");
      setEmailStatus((prev) => ({
        ...prev,
        isAvailable: false,
      }));
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  useEffect(() => {
    let isValid = true;
    let error: string | null = null;

    if (!debouncedUsername) {
      isValid = false;
      error = "Username is required";
    } else if (debouncedUsername.length < 3) {
      isValid = false;
      error = "Username must be at least 3 characters";
    } else if (debouncedUsername.length > 20) {
      isValid = false;
      error = "Username must be 20 characters or less";
    } else if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) {
      isValid = false;
      error = "Username can only contain letters, numbers, and underscores";
    }

    setUsernameStatus((prev) => ({
      ...prev,
      isValid,
      error,
    }));

    if (isValid && debouncedUsername) {
      checkUsernameAvailability(debouncedUsername);
    } else {
      setUsernameStatus((prev) => ({
        ...prev,
        isAvailable: null,
        suggestions: [],
      }));
    }
  }, [debouncedUsername]);

  useEffect(() => {
    let isValid = true;
    let error: string | null = null;

    if (!debouncedEmail) {
      isValid = false;
      error = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail)) {
      isValid = false;
      error = "Please enter a valid email address";
    }

    setEmailStatus((prev) => ({
      ...prev,
      isValid,
      error,
    }));

    if (isValid && debouncedEmail) {
      checkEmailAvailability(debouncedEmail);
    } else {
      setEmailStatus((prev) => ({
        ...prev,
        isAvailable: null,
      }));
    }
  }, [debouncedEmail]);

  const handleSuggestionClick = (suggestion: string) => {
    setFormData((prev) => ({
      ...prev,
      username: suggestion,
    }));
  };

  const requiredFields: (keyof RegisterStep1Data)[] = [
    "fullName",
    "email",
    "phone",
    "username",
    "password",
    "confirmPassword",
  ];

  const getFormErrors = () => {
    return requiredFields.reduce<
      Partial<Record<keyof RegisterStep1Data, string | null>>
    >((acc, field) => {
      acc[field] = getFieldError(field, formData[field]);
      return acc;
    }, {});
  };

  const isFormValid = () => {
    const formErrors = getFormErrors();
    const hasAllValues = requiredFields.every((field) =>
      formData[field].trim()
    );

    const hasNoErrors = Object.values({ ...errors, ...formErrors }).every(
      (error) => !error
    );

    const isUsernameAvailable =
      usernameStatus.isValid &&
      usernameStatus.isAvailable === true &&
      !isCheckingUsername;

    const isEmailAvailable =
      emailStatus.isValid &&
      emailStatus.isAvailable === true &&
      !isCheckingEmail;

    const passwordsMatch =
      formData.password === formData.confirmPassword &&
      formData.password.length >= 10;

    return (
      hasAllValues &&
      hasNoErrors &&
      isUsernameAvailable &&
      isEmailAvailable &&
      passwordsMatch
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setGlobalError(null);

    const newTouched = requiredFields.reduce<
      Partial<Record<keyof RegisterStep1Data, boolean>>
    >((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});

    setTouched(newTouched);

    const latestErrors = getFormErrors();
    setErrors(latestErrors);

    const hasBasicErrors = Object.values(latestErrors).some((error) => error);

    if (hasBasicErrors) {
      setGlobalError("Please fix the errors above before continuing.");
      setIsSubmitting(false);
      return;
    }

    let emailAvailable = false;
    let usernameAvailable = false;

    try {
      if (formData.email) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          emailAvailable = await checkEmailAvailability(formData.email);
        } else {
          setGlobalError("Please enter a valid email address.");
          setIsSubmitting(false);
          return;
        }
      }

      if (formData.username) {
        if (
          formData.username.length >= 3 &&
          formData.username.length <= 20 &&
          /^[a-zA-Z0-9_]+$/.test(formData.username)
        ) {
          usernameAvailable = await checkUsernameAvailability(formData.username);
        } else {
          setGlobalError("Please enter a valid username.");
          setIsSubmitting(false);
          return;
        }
      }

      if (!emailAvailable) {
        setGlobalError(
          "This email address is already registered. Please use a different email or try signing in."
        );
        setIsSubmitting(false);
        return;
      }

      if (!usernameAvailable) {
        setGlobalError(
          "This username is already taken. Please choose a different username."
        );
        setIsSubmitting(false);
        return;
      }

      onNext(formData);
    } catch (err) {
      debugError("Error during availability check:", err);
      setGlobalError(
        "Failed to verify email and username availability. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  const fieldLabelClass = "text-sm font-semibold text-slate-700";
  const fieldLabelRowClass = "mb-2 flex flex-wrap items-center gap-1.5";
  const fieldHelpButtonClass =
    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[#4B9EC8] transition-colors hover:bg-[#D6EBF5] hover:text-[#3382AA] focus:outline-none focus:ring-2 focus:ring-[#4B9EC8] focus:ring-offset-2";
  const fieldHelpIconClass = "h-4 w-4";
  const fieldHelpNoteClass =
    "mb-3 rounded-lg bg-[#F5FBFE] px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-[#D6EBF5]";
  const fieldInputClass =
    "w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 shadow-sm transition-all placeholder:text-slate-400 hover:border-[#4B9EC8] focus:border-[#4B9EC8] focus:outline-none focus:ring-4 focus:ring-[#4B9EC8]/15";
  const fieldInputWithRightIconClass = `${fieldInputClass} pr-12`;
  const passwordInputClass = `${fieldInputClass} pl-10 pr-12`;

  const normalizedEmailName = formData.email.split("@")[0]?.toLowerCase() || "";
  const passwordLower = formData.password.toLowerCase();

  const avoidsPersonalInfo = Boolean(
    formData.password &&
      (!formData.username ||
        !passwordLower.includes(formData.username.toLowerCase())) &&
      (!normalizedEmailName || !passwordLower.includes(normalizedEmailName))
  );

  const showPasswordRequirements =
    isPasswordFocused || Boolean(formData.password);

  const helperNotes: Record<keyof RegisterStep1Data, string> = {
    fullName: "Used for account review only. This will not appear on your profile.",
    email:
      "Used for account updates, login, and verification. This will not appear on your profile.",
    phone:
      "Used only if we need to verify your account. This will not appear on your profile.",
    username:
      "This is the name other users may see inside Tea Time Cari. You can choose something private.",
    password: "Use at least 10 characters. Avoid using your username or email.",
    confirmPassword: "Re-enter your password to make sure it matches.",
  };

  const renderFieldLabel = (field: keyof RegisterStep1Data, label: string) => {
    const helperId = `${field}-help-note`;
    const isOpen = activeHelpField === field;

    return (
      <>
        <div className={fieldLabelRowClass}>
          <label htmlFor={field} className={fieldLabelClass}>
            {label}
          </label>

          <button
            type="button"
            onClick={() => setActiveHelpField(isOpen ? null : field)}
            className={fieldHelpButtonClass}
            aria-label={`Show help for ${label}`}
            aria-expanded={isOpen}
            aria-controls={helperId}
          >
            <HelpCircle className={fieldHelpIconClass} aria-hidden="true" />
          </button>
        </div>

        {isOpen && (
          <p id={helperId} className={fieldHelpNoteClass} role="note">
            {helperNotes[field]}
          </p>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-8 shadow-[0_25px_70px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-10">
        <div
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]"
          aria-hidden="true"
        />

        <RegistrationProgress currentStep={1} className="mb-6" />

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EAF6FC] to-[#D6EBF5] shadow-md ring-4 ring-white">
            <User className="h-8 w-8 text-[#4B9EC8]" />
          </div>

          <span className="inline-flex items-center rounded-full bg-[#F5FBFE] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#3382AA] ring-1 ring-[#D6EBF5]">
            Step 1 of 3 · Basic Information
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Apply to Join
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create your Tea Time Cari account in a few quick steps. If
            approved, we’ll email your access details after review.
          </p>
        </div>

        {globalError && (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
              <span className="text-sm text-red-700">{globalError}</span>
            </div>
          </div>
        )}

        <form
          name="registration-step-1"
          method="POST"
          data-netlify="true"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <input
            type="hidden"
            name="form-name"
            value="registration-step-1"
            readOnly
          />

          <div>
            {renderFieldLabel("fullName", "Full Name")}

            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange("fullName")}
              onBlur={handleBlur("fullName")}
              className={`${fieldInputClass} ${
                errors.fullName && touched.fullName
                  ? "border-[#D96E6E] bg-red-50"
                  : ""
              }`}
              placeholder="e.g., John Smith"
              aria-invalid={errors.fullName && touched.fullName ? "true" : "false"}
              autoFocus
              autoComplete="name"
            />

            {errors.fullName && touched.fullName && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.fullName}
              </p>
            )}
          </div>

          <div>
            {renderFieldLabel("email", "Email Address")}

            <div className="relative">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange("email")}
                onBlur={handleBlur("email")}
                className={`${fieldInputWithRightIconClass} ${
                  (errors.email && touched.email) || emailStatus.error
                    ? "border-[#D96E6E] bg-red-50"
                    : emailStatus.isAvailable === true
                    ? "border-[#4B9EC8] bg-[#D6EBF5]"
                    : ""
                }`}
                placeholder="e.g., john@example.com"
                aria-invalid={
                  (errors.email && touched.email) || emailStatus.error
                    ? "true"
                    : "false"
                }
                autoComplete="email"
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingEmail ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : emailStatus.isAvailable === true ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : emailStatus.isAvailable === false ? (
                  <X className="h-5 w-5 text-red-500" />
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

            {isCheckingEmail && (
              <p className="mt-2 text-sm text-slate-500" role="status">
                Checking email availability…
              </p>
            )}
          </div>

          <div>
            {renderFieldLabel("phone", "Phone Number")}

            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange("phone")}
              onBlur={handleBlur("phone")}
              className={`${fieldInputClass} ${
                errors.phone && touched.phone ? "border-[#D96E6E] bg-red-50" : ""
              }`}
              placeholder="Enter your phone number"
              aria-invalid={errors.phone && touched.phone ? "true" : "false"}
              autoComplete="tel"
            />

            {errors.phone && touched.phone && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            {renderFieldLabel("username", "Username")}

            <div className="relative">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange("username")}
                onBlur={handleBlur("username")}
                className={`${fieldInputWithRightIconClass} ${
                  errors.username && touched.username
                    ? "border-[#D96E6E] bg-red-50"
                    : usernameStatus.isAvailable === true
                    ? "border-[#4B9EC8] bg-[#D6EBF5]"
                    : usernameStatus.isAvailable === false
                    ? "border-[#D96E6E] bg-red-50"
                    : ""
                }`}
                placeholder="e.g., john_smith or johnsmith123"
                aria-invalid={
                  errors.username && touched.username ? "true" : "false"
                }
                autoComplete="username"
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingUsername ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : usernameStatus.isAvailable === true ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : usernameStatus.isAvailable === false ? (
                  <X className="h-5 w-5 text-red-500" />
                ) : null}
              </div>
            </div>

            {usernameStatus.error && touched.username && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {usernameStatus.error}
              </p>
            )}

            {isCheckingUsername && (
              <p className="mt-2 text-sm text-slate-500" role="status">
                Checking username availability…
              </p>
            )}

            {usernameStatus.isAvailable === true && (
              <p className="mt-2 text-sm text-green-600" role="status">
                ✅ Username is available
              </p>
            )}

            {usernameStatus.isAvailable === false && (
              <div className="mt-2">
                <p className="mb-2 text-sm text-red-600" role="alert">
                  ❌ Username is already in use. Try a suggestion or choose
                  another.
                </p>

                {usernameStatus.suggestions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-gray-600">
                      Try these suggestions:
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {usernameStatus.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="rounded-full bg-[#D6EBF5] px-3 py-1 text-xs font-medium text-[#3382AA] transition-colors hover:bg-[#BEE0EF]"
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

          <div>
            {renderFieldLabel("password", "Password")}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange("password")}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => {
                  setIsPasswordFocused(false);
                  handleBlur("password")();
                }}
                className={`${passwordInputClass} ${
                  errors.password && touched.password
                    ? "border-[#D96E6E] bg-red-50"
                    : ""
                }`}
                placeholder="Create a secure password"
                required
                autoComplete="new-password"
                minLength={10}
                aria-invalid={errors.password && touched.password ? "true" : "false"}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                aria-label={showPassword ? "Hide password" : "Show password"}
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

          <div>
            {renderFieldLabel("confirmPassword", "Confirm Password")}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange("confirmPassword")}
                onBlur={handleBlur("confirmPassword")}
                className={`${passwordInputClass} ${
                  errors.confirmPassword && touched.confirmPassword
                    ? "border-[#D96E6E] bg-red-50"
                    : touched.confirmPassword &&
                      formData.confirmPassword &&
                      formData.password === formData.confirmPassword
                    ? "border-[#4B9EC8] bg-[#D6EBF5]"
                    : ""
                }`}
                placeholder="Type your password again"
                required
                autoComplete="new-password"
                minLength={10}
                aria-invalid={
                  errors.confirmPassword && touched.confirmPassword
                    ? "true"
                    : "false"
                }
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                aria-label={
                  showConfirmPassword
                    ? "Hide password confirmation"
                    : "Show password confirmation"
                }
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

            {touched.confirmPassword &&
              formData.confirmPassword &&
              formData.password === formData.confirmPassword &&
              formData.password.length >= 10 && (
                <p className="mt-2 text-sm text-green-600" role="status">
                  ✅ Passwords match
                </p>
              )}
          </div>

          {showPasswordRequirements && (
            <div
              className="rounded-xl bg-gradient-to-r from-blue-50 to-pink-50 p-3 ring-1 ring-[#D6EBF5]"
              role="status"
              aria-live="polite"
            >
              <p className="mb-2 text-sm font-medium text-slate-700">
                Password must include:
              </p>

              <ul className="space-y-1 text-xs leading-5 text-slate-600">
                <li
                  className={`flex items-center gap-2 ${
                    formData.password.length >= 10 ? "text-green-700" : ""
                  }`}
                >
                  <span aria-hidden="true">
                    {formData.password.length >= 10 ? "✓" : "•"}
                  </span>
                  At least 10 characters
                </li>

                <li
                  className={`flex items-center gap-2 ${
                    formData.password &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword &&
                    formData.password.length >= 10
                      ? "text-green-700"
                      : ""
                  }`}
                >
                  <span aria-hidden="true">
                    {formData.password &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword &&
                    formData.password.length >= 10
                      ? "✓"
                      : "•"}
                  </span>
                  Passwords must match
                </li>

                <li
                  className={`flex items-center gap-2 ${
                    avoidsPersonalInfo ? "text-green-700" : ""
                  }`}
                >
                  <span aria-hidden="true">
                    {avoidsPersonalInfo ? "✓" : "•"}
                  </span>
                  Avoid using your username or email
                </li>
              </ul>
            </div>
          )}

          <div className="flex space-x-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className={`${onBack ? "flex-1" : "w-full"} rounded-xl px-4 py-3 font-semibold transition-all duration-200 ${
                isFormValid() && !isSubmitting
                  ? "bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] text-white shadow-lg shadow-[#4B9EC8]/25 hover:-translate-y-0.5 hover:from-[#3382AA] hover:to-[#BC5050] hover:shadow-xl hover:shadow-[#4B9EC8]/30"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
            >
              {isSubmitting ? "Checking..." : "Next Step"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}