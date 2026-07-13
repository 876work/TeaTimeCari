import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { GradientPageShell } from '@/components/GradientPageShell';

export default function NotFound() {
  return (
    <GradientPageShell maxWidth="max-w-lg" cardClassName="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#D6EBF5]">
        <Compass className="h-8 w-8 text-[#4B9EC8]" />
      </div>
      <h1 className="mb-3 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mb-8 text-gray-600">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] px-6 py-3 font-medium text-white shadow-md transition-all hover:shadow-lg"
      >
        Back to home
      </Link>
    </GradientPageShell>
  );
}
