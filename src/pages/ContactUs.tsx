import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, User, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function ContactUs() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ContactFormData>({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormData, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (submitError) setSubmitError(null);
  };

  const handleBlur = (field: keyof ContactFormData) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const validateField = (field: keyof ContactFormData, value: string) => {
    let error: string | null = null;
    switch (field) {
      case 'name':
        if (!value.trim()) error = 'Name is required';
        break;
      case 'email':
        if (!value.trim()) error = 'Email address is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Please enter a valid email address';
        break;
      case 'phone':
        if (value.trim() && !/^758\d{7}$/.test(value.replace(/\D/g, '')))
          error = 'Phone number must be in format: 758xxxxxxx';
        break;
      case 'message':
        if (!value.trim()) error = 'Message is required';
        else if (value.trim().length < 10) error = 'Message must be at least 10 characters';
        break;
    }
    setErrors(prev => ({ ...prev, [field]: error ?? undefined }));
  };

  const isFormValid = () => {
    const requiredFields: (keyof ContactFormData)[] = ['name', 'email', 'message'];
    const hasAllRequiredValues = requiredFields.every(field => formData[field].trim());
    const hasNoErrors = Object.values(errors).every(error => !error);
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const isMessageValid = formData.message.trim().length >= 10;
    return hasAllRequiredValues && hasNoErrors && isEmailValid && isMessageValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allFields: (keyof ContactFormData)[] = ['name', 'email', 'phone', 'message'];
    setTouched(allFields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));
    allFields.forEach(field => validateField(field, formData[field]));
    if (!isFormValid()) { setSubmitError('Please fix the errors above before submitting.'); return; }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsSubmitted(true);
    } catch {
      setSubmitError('Failed to submit your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6"
            style={{ background: "rgba(110,231,183,0.15)" }}>
            <CheckCircle className="w-7 h-7" style={{ color: "#6ee7b7" }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Message Sent!</h1>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Thank you for contacting us. We'll get back to you within 24 hours.
          </p>
          <div className="space-y-3">
            <button onClick={() => navigate('/')} className="dark-btn">
              Go to Homepage
              <span />
            </button>
            <button
              onClick={() => { setIsSubmitted(false); setFormData({ name: '', email: '', phone: '', message: '' }); setTouched({}); setErrors({}); }}
              className="w-full py-2 text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              Send Another Message
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="dark-form-box w-full max-w-md mx-auto px-10 py-12">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #A3C6E0, #E0A3A3)" }}>
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Contact Support</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Need help? Send us a message and we'll get back to you soon.
          </p>
        </div>

        {submitError && (
          <div className="dark-alert-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className={`form-field ${formData.name ? "has-value" : ""}`}>
            <input
              type="text"
              id="c-name"
              value={formData.name}
              onChange={handleInputChange('name')}
              onBlur={handleBlur('name')}
              required
              disabled={isSubmitting}
              className={errors.name && touched.name ? "input-error" : ""}
            />
            <label htmlFor="c-name">Full Name *</label>
            {errors.name && touched.name && <span className="field-error">{errors.name}</span>}
          </div>

          {/* Email */}
          <div className={`form-field ${formData.email ? "has-value" : ""}`}>
            <input
              type="email"
              id="c-email"
              value={formData.email}
              onChange={handleInputChange('email')}
              onBlur={handleBlur('email')}
              required
              disabled={isSubmitting}
              autoComplete="email"
              className={errors.email && touched.email ? "input-error" : ""}
            />
            <label htmlFor="c-email">Email Address *</label>
            {errors.email && touched.email && <span className="field-error">{errors.email}</span>}
          </div>

          {/* Phone */}
          <div className={`form-field ${formData.phone ? "has-value" : ""}`}>
            <input
              type="text"
              id="c-phone"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              onBlur={handleBlur('phone')}
              disabled={isSubmitting}
              autoComplete="tel"
              className={errors.phone && touched.phone ? "input-error" : ""}
            />
            <label htmlFor="c-phone">Phone Number (optional)</label>
            {errors.phone && touched.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          {/* Message */}
          <div className={`form-field ${formData.message ? "has-value" : ""}`}>
            <textarea
              id="c-message"
              value={formData.message}
              onChange={handleInputChange('message')}
              onBlur={handleBlur('message')}
              rows={5}
              required
              disabled={isSubmitting}
              maxLength={1000}
              className={errors.message && touched.message ? "input-error" : ""}
            />
            <label htmlFor="c-message">Message *</label>
            <div className="flex justify-between items-center mt-1">
              {errors.message && touched.message
                ? <span className="field-error">{errors.message}</span>
                : <span />
              }
              <span className="text-xs" style={{ color: formData.message.length > 1000 ? "#E0A3A3" : "rgba(255,255,255,0.3)" }}>
                {formData.message.length}/1000
              </span>
            </div>
          </div>

          <div className="text-center mt-4">
            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className="dark-btn"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                  <Loader2 className="animate-spin w-4 h-4" /> Sending...
                </span>
              ) : (
                <>
                  <Send className="inline w-4 h-4 mr-2" />
                  Send Message
                  <span />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 mx-auto text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
          <div className="dark-alert-info text-center">
            <strong>Response Time:</strong> We typically respond within 24 hours during business days.
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
