import { Link } from 'react-router-dom';
import { Users, Heart, Star, Shield, Clock } from 'lucide-react';
import { HowItWorksStepper } from './HowItWorksStepper';
import { SiteHeader } from './SiteHeader';

export function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E] px-4 py-4 sm:py-6">
      <SiteHeader />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white bg-opacity-15 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-white bg-opacity-10 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-white bg-opacity-10 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-1/3 w-20 h-20 bg-white bg-opacity-15 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-12 text-center sm:py-16">
        {/* Main Logo */}
        <div className="mb-8">
          <div className="mx-auto w-32 h-32 mb-6 drop-shadow-2xl">
            <img
              src="/teaLogo.png"
              alt="Tea Time Cari"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight drop-shadow-md">
          Tea Time Cari
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-white/95 mb-8 font-light leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
          Connect, share, and discover in a community built for authentic conversations
        </p>

        <div className="mb-12 flex justify-center">
          <Link to="/signup" className="home-start-toggle" aria-label="Get Started with Tea Time Cari">
            <span className="home-start-track-lines" aria-hidden="true">
              <span className="home-start-track-line" />
            </span>
            <span className="home-start-thumb" aria-hidden="true">
              <span className="home-start-thumb-core" />
              <span className="home-start-thumb-inner" />
              <span className="home-start-thumb-scan" />
              <span className="home-start-particles">
                <span className="home-start-particle" />
                <span className="home-start-particle" />
                <span className="home-start-particle" />
                <span className="home-start-particle" />
                <span className="home-start-particle" />
              </span>
            </span>
            <span className="home-start-data">
              <span className="home-start-text home-start-text-ready">Get Started</span>
              <span className="home-start-text home-start-text-go">Let's Go</span>
              <span className="home-start-status home-start-status-ready" aria-hidden="true" />
              <span className="home-start-status home-start-status-go" aria-hidden="true" />
            </span>
            <span className="home-start-energy-rings" aria-hidden="true">
              <span className="home-start-energy-ring" />
              <span className="home-start-energy-ring" />
              <span className="home-start-energy-ring" />
            </span>
            <span className="home-start-interface-lines" aria-hidden="true">
              <span className="home-start-interface-line" />
              <span className="home-start-interface-line" />
              <span className="home-start-interface-line" />
              <span className="home-start-interface-line" />
              <span className="home-start-interface-line" />
              <span className="home-start-interface-line" />
            </span>
            <span className="home-start-reflection" aria-hidden="true" />
            <span className="home-start-glow" aria-hidden="true" />
          </Link>
        </div>

        <HowItWorksStepper />

        {/* Feature highlights */}
        <div id="about" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto scroll-mt-32">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/25 shadow-lg">
            <Users className="w-8 h-8 mx-auto mb-3 text-white drop-shadow" />
            <h3 className="font-semibold mb-2">Community Driven</h3>
            <p className="text-sm text-white/90">
              Connect with like-minded individuals in a safe, moderated environment
            </p>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/25 shadow-lg">
            <Shield className="w-8 h-8 mx-auto mb-3 text-white drop-shadow" />
            <h3 className="font-semibold mb-2">Verified Users</h3>
            <p className="text-sm text-white/90">
              All members go through a verification process for your safety
            </p>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/25 shadow-lg">
            <Heart className="w-8 h-8 mx-auto mb-3 text-white drop-shadow" />
            <h3 className="font-semibold mb-2">Authentic Sharing</h3>
            <p className="text-sm text-white/90">
              Share photos and get genuine feedback from the community
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-6">
          <p className="text-white/80 text-sm font-medium">
            Join our growing community of verified members
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-white/80">
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4" />
            <span className="text-sm font-medium">Secure Platform</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">24/7 Moderation</span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Privacy Protected</span>
          </div>
        </div>

      </div>
    </div>
  );
}