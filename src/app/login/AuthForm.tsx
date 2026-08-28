"use client";

import { useState } from "react";
import { login, signup } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClass = "block text-sm font-medium text-gray-700";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <>
      <div className="mb-6 flex rounded-md border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 ${
            mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-1.5 ${
            mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === "login" ? (
        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Office email
            </label>
            <input id="email" name="email" type="email" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Log in
          </button>
        </form>
      ) : (
        <form action={signup} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lastName" className={labelClass}>
                Last name
              </label>
              <input id="lastName" name="lastName" type="text" required className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="yearsExperience" className={labelClass}>
              Years of total experience
            </label>
            <input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              step={1}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="organizationName" className={labelClass}>
              Organization name
            </label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Signing up creates a new organization with you as admin. To join
              an existing one instead, use the invite link your admin sent
              you.
            </p>
          </div>
          <div>
            <label htmlFor="signupEmail" className={labelClass}>
              Office email
            </label>
            <input
              id="signupEmail"
              name="email"
              type="email"
              required
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500">
              Requires a work/office email address -- personal providers like
              Gmail, Yahoo, or Outlook.com aren&apos;t accepted.
            </p>
          </div>
          <div>
            <label htmlFor="signupPassword" className={labelClass}>
              Password
            </label>
            <input
              id="signupPassword"
              name="password"
              type="password"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Sign up
          </button>
        </form>
      )}
    </>
  );
}
