import Link from 'next/link';

export default function AuthCodeErrorPage() {
  return (
    <div className="bg-white py-8 px-6 shadow rounded-lg">
      <div className="text-center">
        <div className="mb-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Authentication Error
        </h2>
        
        <p className="text-gray-600 mb-6">
          Sorry, we couldn't authenticate your account. This could be due to an expired or invalid link.
        </p>
        
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try signing in again
          </Link>
          
          <Link
            href="/auth/forgot-password"
            className="block w-full text-blue-600 hover:text-blue-500 transition-colors"
          >
            Request a new password reset link
          </Link>
        </div>
      </div>
    </div>
  );
}