import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  User,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const CONTACT_FORM_NAME = "contact";

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

  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    message: "",
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
        <div className="bg-white rounded-2xl shadow-xl p-8">
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
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white rounded-lg font-medium shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
              >
                Go to Homepage
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  resetForm();
                }}
                className="w-full px-6 py-3 border border-[#4B9EC8]/40 text-[#2E6F91] rounded-lg font-medium hover:bg-[#D6EBF5] hover:border-[#4B9EC8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EC8] focus-visible:ring-offset-2"
              >
                Send Another Message
              </button>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl shadow-xl p-8">
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

        {submitError && (
          <div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{submitError}</span>
            </div>
          </div>
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

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Full Name *
            </label>

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

            {errors.name && touched.name && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address *
            </label>

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

            {errors.email && touched.email && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Phone Number <span className="text-gray-500">(optional)</span>
            </label>

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

            {errors.phone && touched.phone && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Message *
            </label>

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
          </div>

          <button
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid() && !isSubmitting
                ? "bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Sending Message...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Send className="w-5 h-5 mr-2" />
                Send Message
              </div>
            )}
          </button>
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 text-center">
              <strong>Response Time:</strong> We typically respond within 24
              hours during business days.
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              For urgent matters, you can also reach us directly via email or
              phone if provided during registration.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}