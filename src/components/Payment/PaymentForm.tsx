import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { CreditCard, Loader2, Lock, CheckCircle } from 'lucide-react';

interface PaymentFormProps {
  amount: number;
  currency: string;
  feedAccess: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PaymentForm({ amount, currency, feedAccess, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const supabase = useSupabaseClient();
  const session = useSession();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !session?.user?.id) {
      onError('Payment system not ready. Please try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card information not found. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent via Edge Function
      const { data: intentData, error: intentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          feedAccess,
          amount,
          currency
        }
      });

      if (intentError) {
        throw new Error(intentError.message || 'Failed to create payment intent');
      }

      if (!intentData.success || !intentData.paymentIntent) {
        throw new Error(intentData.error || 'Payment setup failed');
      }

      // Confirm payment with Stripe
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        intentData.paymentIntent.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: session.user.email,
            },
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      if (paymentIntent?.status === 'succeeded') {
        // Update payment status in database
        const { error: updateError } = await supabase
          .from('payments')
          .update({ status: 'completed' })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.warn('Failed to update payment status:', updateError);
          // Don't fail the process if we can't update the status
        }

        onSuccess();
      } else {
        throw new Error('Payment was not completed successfully');
      }

    } catch (err: any) {
      console.error('Payment error:', err);
      onError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: true,
  };

  return (
    <form name="payment" method="POST" data-netlify="true" onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="form-name" value="payment" readOnly />
      <input type="hidden" name="amount" value={amount} readOnly />
      <input type="hidden" name="currency" value={currency} readOnly />
      <input type="hidden" name="feedAccess" value={feedAccess} readOnly />
      {/* Payment Amount Display */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            ${(amount / 100).toFixed(2)} {currency.toUpperCase()}
          </div>
          <div className="text-gray-600">
            3-day access to {feedAccess === 'opposite' ? 'Premium' : 'Standard'} feed
          </div>
        </div>
      </div>

      {/* Card Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          <div className="flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Card Information
          </div>
        </label>
        <div className="border border-gray-300 rounded-lg p-4 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <CardElement
            options={cardElementOptions}
            onChange={(event) => {
              setCardComplete(event.complete);
              if (event.error) {
                onError(event.error.message);
              }
            }}
          />
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center justify-center text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <Lock className="w-4 h-4 mr-2" />
        <span>Your payment information is secure and encrypted</span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || !cardComplete || isProcessing}
        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
          stripe && cardComplete && !isProcessing
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-6 w-6 mr-3" />
            Processing Payment...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <CheckCircle className="w-6 h-6 mr-3" />
            Complete Payment
          </div>
        )}
      </button>

      {/* Terms */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          By completing this payment, you agree to our terms of service. 
          Access is non-refundable and expires after 3 days.
        </p>
      </div>
    </form>
  );
}
