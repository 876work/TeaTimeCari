import React from 'react';
import { Coffee, Users, Heart, ArrowRight, Star, Shield, Clock } from 'lucide-react';

interface HomePageProps {
  onGetStarted: () => void;
}

export function HomePage({ onGetStarted }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3] flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-white bg-opacity-5 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-white bg-opacity-5 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-1/3 w-20 h-20 bg-white bg-opacity-10 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Main Logo/Icon */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 shadow-2xl">
            <Coffee className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight">
          Tea Time Cari
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-white text-opacity-90 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
          Connect, share, and discover in a community built for authentic conversations
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Users className="w-8 h-8 mx-auto mb-3 text-white" />
            <h3 className="font-semibold mb-2">Community Driven</h3>
            <p className="text-sm text-white text-opacity-80">
              Connect with like-minded individuals in a safe, moderated environment
            </p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Shield className="w-8 h-8 mx-auto mb-3 text-white" />
            <h3 className="font-semibold mb-2">Verified Users</h3>
            <p className="text-sm text-white text-opacity-80">
              All members go through a verification process for your safety
            </p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 text-white">
            <Heart className="w-8 h-8 mx-auto mb-3 text-white" />
            <h3 className="font-semibold mb-2">Authentic Sharing</h3>
            <p className="text-sm text-white text-opacity-80">
              Share photos and get genuine feedback from the community
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-6">
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center px-8 py-4 bg-white text-gray-900 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 ease-out"
          >
            <span className="mr-3">Get Started</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
          
          <p className="text-white text-opacity-70 text-sm">
            Join our growing community of verified members
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex items-center justify-center space-x-8 text-white text-opacity-60">
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4" />
            <span className="text-sm">Secure Platform</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">24/7 Moderation</span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm">Privacy Protected</span>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-white text-opacity-50 text-xs">
            By continuing, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  );
}