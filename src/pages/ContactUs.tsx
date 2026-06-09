import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, PageSection, PrimaryButton, PrivacyNote, StatusAlert } from "../components/Form";

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const CONTACT_FORM_NAME = "contact";

const getAccountStatusSupportCopy = (status: string | null) => {
  switch (status) {
    case "pending":
      return "I need help with my pending application status. I understand I do not need to submit another application unless support asks me to.";
    case "rejected":
      return "I need help with an account that was not approved. Please let me know what next steps are available.";
    case "suspended":
      return "I need help with a suspended account. I believe this may need review by support.";
    case "banned":
      return "I need help with an unavailable account. Please review whether support can assist with next steps.";
    case "missing":
      return "I need help because my completed application could not be found. I may have used a different email or may need to finish signup.";
    case "signed_out":
      return "I need help checking my account status because I cannot access the original login session or application email.";
    default:
      return "I need help with my Tea Time Cari account status. Please let me know the next steps.";
  }
};

const getFieldError = (
  field: keyof ContactFormData,
  value: string,
): string | null => {
  switch (field) {
    case "name":
      return value.trim() ? null : "Name is required";

    case "email":
      if (!value.trim()) {
        return "Email address is required";
      }

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : "Please enter a valid email address";

    case "phone":
      return null;

    case "message":
      if (!value.trim()) {
        return "Message is required";
      }

      return value.trim().length >= 10
        ? null
        : "Message must be at least 10 characters";

    default:
      return null;
  }
};

const encodeContactFormData = (data: ContactFormData) => {
  return new URLSearchParams({
    "form-name": CONTACT_FORM_NAME,
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    message: data.message.trim(),
  }).toString();
};

export default function ContactUs() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isAccountStatusHelp = query.get("topic") === "account-status";

  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    message: isAccountStatusHelp
      ? getAccountStatusSupportCopy(query.get("status"))
      : "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof ContactFormData, string | null>>
  >({});

  const [touched, setTouched] = useState<
    Partial<Record<keyof ContactFormData, boolean>>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange =
    (field: keyof ContactFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;

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

      if (submitError) {
        setSubmitError(null);
      }
    };

  const handleBlur = (field: keyof ContactFormData) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));

    validateField(field, formData[field]);
  };

  const validateField = (field: keyof ContactFormData, value: string) => {
    const error = getFieldError(field, value);

    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));

    return error;
  };

  const getFormErrors = () => {
    const allFields: (keyof ContactFormData)[] = [
      "name",
      "email",
      "phone",
      "message",
    ];

    return allFields.reduce<
      Partial<Record<keyof ContactFormData, string | null>>
    >((acc, field) => {
      acc[field] = getFieldError(field, formData[field]);
      return acc;
    }, {});
  };

  const isFormValid = () => {
    return Object.values(getFormErrors()).every((error) => !error);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      message: "",
    });
    setTouched({});
    setErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allFields: (keyof ContactFormData)[] = [
      "name",
      "email",
      "phone",
      "message",
    ];

    const newTouched = allFields.reduce<
      Partial<Record<keyof ContactFormData, boolean>>
    >((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});

    setTouched(newTouched);

    const formErrors = getFormErrors();
    setErrors(formErrors);

    if (Object.values(formErrors).some((error) => error)) {
      setSubmitError("Please fix the errors above before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: encodeContactFormData(formData),
      });

      if (!response.ok) {
        throw new Error(
          `Netlify form submission failed with status ${response.status}`,
        );
      }

      setIsSubmitted(true);
      resetForm();
    } catch (err: unknown) {
      console.error("Error submitting contact form:", err);
      setSubmitError("Failed to submit your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate("/");
  };

  if (isSubmitted) {
    return (
      <AuthLayout>
        <PageSection>
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Message Sent Successfully!
            </h1>

            <p className="text-gray-600 mb-6">
              Thank you for contacting us. We'll get back to you within 24
              hours.
            </p>

            <div className="space-y-3">
              <PrimaryButton type="button" onClick={handleGoHome}>
                Go to Homepage
              </PrimaryButton>

              <PrimaryButton
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  resetForm();
                }}
                variant="secondary"
              >
                Send Another Message
              </PrimaryButton>
            </div>
          </div>
        </PageSection>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <PageSection>
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-[#4B9EC8]" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Contact Support
          </h1>

          <p className="text-gray-600">
            Need help? Send us a message and we'll get back to you soon.
          </p>
        </div>

        {isAccountStatusHelp && (
          <PrivacyNote className="mb-6" title="Account status help">
            Tell us the email you used to apply and what you expected to happen.
            For your privacy, please do not include passwords, ID numbers, or payment details.
          </PrivacyNote>
        )}

        {submitError && (
          <StatusAlert variant="error" className="mb-6">
            {submitError}
          </StatusAlert>
        )}

        <form
          name={CONTACT_FORM_NAME}
          method="POST"
          data-netlify="true"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <input
            type="hidden"
            name="form-name"
            value={CONTACT_FORM_NAME}
            readOnly
          />

          <FormField id="name" label="Full Name" required error={errors.name && touched.name ? errors.name : null}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange("name")}
                onBlur={handleBlur("name")}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name && touched.name
                    ? "border-[#D96E6E] bg-red-50"
                    : "border-gray-300 bg-white hover:border-[#4B9EC8]"
                }`}
                placeholder="Enter your full name"
                required
                disabled={isSubmitting}
              />
            </div>
          </FormField>

          <FormField id="email" label="Email Address" required error={errors.email && touched.email ? errors.email : null}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange("email")}
                onBlur={handleBlur("email")}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email && touched.email
                    ? "border-[#D96E6E] bg-red-50"
                    : "border-gray-300 bg-white hover:border-[#4B9EC8]"
                }`}
                placeholder="Enter your email address"
                required
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
          </FormField>

          <FormField id="phone" label="Phone Number" helpText={<span>(optional)</span>} error={errors.phone && touched.phone ? errors.phone : null}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>

              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange("phone")}
                onBlur={handleBlur("phone")}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone && touched.phone
                    ? "border-[#D96E6E] bg-red-50"
                    : "border-gray-300 bg-white hover:border-[#4B9EC8]"
                }`}
                placeholder="Enter your phone number"
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>
          </FormField>

          <FormField id="message" label="Message" required>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <MessageSquare className="h-5 w-5 text-gray-400" />
              </div>

              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange("message")}
                onBlur={handleBlur("message")}
                rows={5}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.message && touched.message
                    ? "border-[#D96E6E] bg-red-50"
                    : "border-gray-300 bg-white hover:border-[#4B9EC8]"
                }`}
                placeholder="Please describe how we can help you..."
                required
                disabled={isSubmitting}
                maxLength={1000}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              {errors.message && touched.message ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.message}
                </p>
              ) : (
                <div />
              )}

              <span
                className={`text-xs ${
                  formData.message.length > 1000
                    ? "text-red-600"
                    : "text-gray-500"
                }`}
              >
                {formData.message.length}/1000 characters
              </span>
            </div>
          </FormField>

          <PrimaryButton
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            isLoading={isSubmitting}
            loadingLabel="Sending Message..."
            icon={<Send className="h-5 w-5" />}
          >
            Send Message
          </PrimaryButton>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>

          <StatusAlert variant="info" title="Response Time">
            We typically respond within 24 hours during business days.
          </StatusAlert>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              For urgent matters, you can also reach us directly via email or
              phone if provided during registration.
            </p>
          </div>
        </div>
      </PageSection>
    </AuthLayout>
  );
}