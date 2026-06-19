export function AuthLoading({ label = 'Checking your account…' }: { label?: string }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-sm text-slate-500">{label}</p></div>;
}
