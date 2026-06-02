import React, { useState, useEffect } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import {
  Shield,
  AlertTriangle,
  Eye, 
  Lock, 
  Skull, 
  Ban,
  LogIn,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { hasPendingSso, finishDiscourseSso } from '@/lib/discourseSso';

export function AdminLoginPage() {
  const session = useSession();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Check if user is already logged in as admin
  useEffect(() => {
    if (session?.user?.email?.includes('admin')) {
      (async () => {
        if (hasPendingSso()) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          await finishDiscourseSso(currentSession?.access_token ?? '');
          return;
        }

        // Redirect to admin dashboard
        window.location.href = '/';
      })();
    }
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user && data.user.email?.includes('admin')) {
        if (hasPendingSso()) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          await finishDiscourseSso(currentSession?.access_token ?? '');
          return;
        }

        // Successful admin login
        window.location.href = '/admin/dashboard';
      } else {
        setError('Access denied. This account does not have administrative privileges.');
        // Sign out non-admin user
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-black flex items-center justify-center p-4">
      {/* Animated warning background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-red-500 opacity-10 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              <AlertTriangle className="w-4 h-4 text-red-400 opacity-30" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Main Warning Card */}
        <div className="bg-black border-4 border-red-500 rounded-2xl shadow-2xl p-8 mb-6 animate-pulse">
          <div className="text-center">
            {/* Skull and warning icons */}
            <div className="flex justify-center items-center mb-6">
              <Skull className="w-12 h-12 text-red-500 mr-4 animate-bounce" />
              <Ban className="w-16 h-16 text-red-600 animate-spin" style={{ animationDuration: '3s' }} />
              <Skull className="w-12 h-12 text-red-500 ml-4 animate-bounce" style={{ animationDelay: '0.5s' }} />
            </div>

            <h1 className="text-4xl font-black text-red-500 mb-4 tracking-wider animate-pulse">
              ⚠️ UNAUTHORIZED ACCESS ⚠️
            </h1>
            
            <div className="bg-red-900 border-2 border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-200 font-bold text-lg mb-2">
                🚨 RESTRICTED AREA 🚨
              </p>
              <p className="text-red-300 text-sm leading-relaxed">
                This is a PRIVATE administrative portal. If you are not an authorized administrator, 
                you are <span className="font-bold text-red-100">STRICTLY PROHIBITED</span> from accessing this area.
              </p>
            </div>

            <div className="space-y-3 text-red-200 text-sm">
              <div className="flex items-center justify-center">
                <Eye className="w-4 h-4 mr-2 text-red-400" />
                <span>All access attempts are monitored and logged</span>
              </div>
              <div className="flex items-center justify-center">
                <Shield className="w-4 h-4 mr-2 text-red-400" />
                <span>Unauthorized access may result in legal action</span>
              </div>
              <div className="flex items-center justify-center">
                <Lock className="w-4 h-4 mr-2 text-red-400" />
                <span>This system is protected by advanced security</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Messages */}
        <div className="space-y-4 mb-6">
          <div className="bg-red-800 border-2 border-red-600 rounded-lg p-4 animate-pulse">
            <p className="text-red-100 text-center font-bold">
              ⛔ LEAVE IMMEDIATELY IF YOU ARE NOT AUTHORIZED ⛔
            </p>
          </div>
          
          <div className="bg-yellow-900 border-2 border-yellow-600 rounded-lg p-4">
            <p className="text-yellow-100 text-center text-sm">
              🔒 Only system administrators with valid credentials may proceed beyond this point
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            🏠 LEAVE NOW - GO TO HOMEPAGE
          </button>

          {!showLoginForm ? (
            <button
              onClick={() => setShowLoginForm(true)}
              className="w-full py-3 px-6 bg-red-900 hover:bg-red-800 text-red-200 font-medium rounded-lg transition-all duration-200 border-2 border-red-600"
            >
              <div className="flex items-center justify-center">
                <Shield className="w-5 h-5 mr-2" />
                I AM AN AUTHORIZED ADMINISTRATOR
              </div>
            </button>
          ) : (
            /* Admin Login Form */
            <div className="dark-form-box px-8 py-8">
              <div className="text-center mb-6">
                <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: "#A3C6E0" }} />
                <h3 className="text-lg font-bold text-white">Administrator Login</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Enter your admin credentials</p>
              </div>

              {error && (
                <div className="dark-alert-error" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className={`form-field ${email ? "has-value" : ""}`}>
                  <input
                    type="email"
                    id="admin-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                  <label htmlFor="admin-email">Admin Email</label>
                </div>

                <div className={`form-field ${password ? "has-value" : ""}`}>
                  <input
                    type="password"
                    id="admin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <label htmlFor="admin-password">Password</label>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setShowLoginForm(false); setError(null); setEmail(''); setPassword(''); }}
                    className="flex-1 py-3 px-4 rounded text-sm font-medium transition-colors"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <div className="flex-1 text-center">
                    <button
                      type="submit"
                      disabled={isLoading || !email || !password}
                      className="dark-btn"
                      style={{ marginTop: 0, letterSpacing: "2px" }}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2 normal-case tracking-normal">
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                        </span>
                      ) : (
                        <>
                          <LogIn className="inline w-4 h-4 mr-1" /> Login
                          <span />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Warning */}
        <div className="text-center mt-6">
          <p className="text-red-400 text-xs font-medium animate-pulse">
            🚨 This area is under constant surveillance 🚨
          </p>
          <p className="text-red-500 text-xs mt-1">
            Unauthorized access attempts will be reported to authorities
          </p>
        </div>
      </div>
    </div>
  );
}