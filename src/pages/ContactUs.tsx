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
  
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFormData, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle input changes
  const handleInputChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear previous errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear submit error
    if (submitError) {
      setSubmitError(null);
    }
  };

  // Handle field blur
  const handleBlur = (field: keyof ContactFormData) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  // Validate individual fields
  const validateField = (field: keyof ContactFormData, value: string) => {
    let error: string | null = null;
    
    switch (field) {
      case 'name':
        if (!value.trim()) {
          error = 'Name is required';
        }
        break;
      case 'email':
        if (!value.trim()) {
          error = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
      case 'phone':
        // Phone is optional, but if provided, validate format
        if (value.trim() && !/^758\d{7}$/.test(value.replace(/\D/g, ''))) {
          error = 'Phone number must be in format: 758xxxxxxx';
        }
        break;
      case 'message':
        if (!value.trim()) {
          error = 'Message is required';
        } else if (value.trim().length < 10) {
          error = 'Message must be at least 10 characters';
        }
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  // Validate entire form
  const isFormValid = () => {
    const requiredFields: (keyof ContactFormData)[] = ['name', 'email', 'message'];
    
    // Check if all required fields have values
    const hasAllRequiredValues = requiredFields.every(field => formData[field].trim());
    
    // Check if no errors exist
    const hasNoErrors = Object.values(errors).every(error => !error);
    
    // Validate email format
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    
    // Validate message length
    const isMessageValid = formData.message.trim().length >= 10;
    
    return hasAllRequiredValues && hasNoErrors && isEmailValid && isMessageValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allFields: (keyof ContactFormData)[] = ['name', 'email', 'phone', 'message'];
    const newTouched = allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    setTouched(newTouched);
    
    // Validate all fields
    allFields.forEach(field => validateField(field, formData[field]));
    
    if (!isFormValid()) {
      setSubmitError('Please fix the errors above before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Simulate form submission - in production, you would send this to your backend
      // For now, we'll just simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Contact form submitted:', formData);
      setIsSubmitted(true);
      
    } catch (err: any) {
      console.error('Error submitting contact form:', err);
      setSubmitError('Failed to submit your message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Success state
  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Message Sent Successfully!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for contacting us. We'll get back to you within 24 hours.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleGoHome}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Homepage
              </button>
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setFormData({ name: '', email: '', phone: '', message: '' });
                  setTouched({});
                  setErrors({});
                }}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-[#A3C6E0]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contact Support</h1>
          <p className="text-gray-600">
            Need help? Send us a message and we'll get back to you soon.
          </p>
        </div>

        {/* Submit Error Message */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{submitError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={handleInputChange('name')}
                onBlur={handleBlur('name')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name && touched.name
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
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

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email && touched.email
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
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

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-gray-500">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="phone"
                value={formData.phone}
                onChange={handleInputChange('phone')}
                onBlur={handleBlur('phone')}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone && touched.phone
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
                }`}
                placeholder="758xxxxxxx"
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

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <MessageSquare className="h-5 w-5 text-gray-400" />
              </div>
              <textarea
                id="message"
                value={formData.message}
                onChange={handleInputChange('message')}
                onBlur={handleBlur('message')}
                rows={5}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.message && touched.message
                    ? 'border-[#E0A3A3] bg-red-50'
                    : 'border-gray-300 bg-white hover:border-[#A3C6E0]'
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
                <div></div>
              )}
              <span className={`text-xs ${
                formData.message.length > 1000 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {formData.message.length}/1000 characters
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid() || isSubmitting}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              isFormValid() && !isSubmitting
                ? 'bg-gradient-to-r from-[#A3C6E0] to-[#E0A3A3] hover:from-[#8BB5D9] hover:to-[#D98B8B] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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

        {/* Help Section */}
        <div className="mt-8 space-y-4">
          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={handleGoBack}
              className="flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
          </div>

          {/* Contact Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 text-center">
              <strong>Response Time:</strong> We typically respond within 24 hours during business days.
            </p>
          </div>

          {/* Alternative Contact */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              For urgent matters, you can also reach us directly via email or phone if provided during registration.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}