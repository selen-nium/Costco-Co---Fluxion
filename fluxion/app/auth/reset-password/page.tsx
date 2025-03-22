"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validHash, setValidHash] = useState(false);
  const router = useRouter();
  
  // Check for access token in the URL hash
  // In your ResetPassword component's useEffect
  useEffect(() => {
    const checkHash = async () => {
      // Only run in browser environment
      if (typeof window === 'undefined') return;
      
      // Check for hash parameters
      const hash = window.location.hash;
      if (!hash) {
        setError('No reset token found. Please request a new password reset link.');
        return;
      }
      
      try {
        // Parse the hash parameters
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        if (accessToken && type === 'recovery') {
          console.log("Found recovery token");
          // Don't try to set session yet, just mark the hash as valid
          setValidHash(true);
          // Store the token for later use
          setResetToken(accessToken);
        } else {
          console.log("Missing or invalid token parameters:", { accessToken, type });
          setError('Invalid reset link. Please request a new password reset link.');
        }
      } catch (err) {
        console.error("Error processing reset link:", err);
        setError('Error processing reset link. Please request a new one.');
      }
    };
    
    checkHash();
  }, []);

  // Add a state to store the token
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (!resetToken) {
      setError("Reset token is missing. Please try again with a new reset link.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Updating password with token...");
      
      // Update password using token directly
      const { error } = await supabase.auth.updateUser(
        { password },
        { accessToken: resetToken }
      );
      
      if (error) {
        console.error("Error updating password:", error);
        throw error;
      }
      
      console.log("Password updated successfully");
      setSuccess(true);
      
      // Redirect to sign-in page after a delay
      setTimeout(() => {
        window.location.href = '/auth/signin?reset=true';
      }, 3000);
    } catch (err: any) {
      console.error("Password reset failed:", err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Reset your password
          </h2>
        </div>
        
        {success ? (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Your password has been reset successfully. Redirecting to login page...</p>
                </div>
              </div>
            </div>
          </div>
        ) : error && !validHash ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {error}
                </p>
                <div className="mt-4">
                  <Link href="/auth/forgot-password" className="text-sm font-medium text-red-800 hover:text-red-700">
                    Request a new password reset link
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="relative block w-full rounded-md border-0 p-2 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="relative block w-full rounded-md border-0 p-2 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading || !validHash}
                className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-400"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
            
            <div className="text-sm text-center">
              <Link href="/auth/signin" className="text-indigo-600 hover:text-indigo-500">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}