export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="13" fill="#e7b15a" />
      <circle cx="20" cy="20" r="8" fill="#1a1208" />
      <circle cx="23.5" cy="17" r="6.5" fill="#e7b15a" />
      <circle cx="24.2" cy="16.2" r="2.1" fill="#fff6e4" />
    </svg>
  );
}
