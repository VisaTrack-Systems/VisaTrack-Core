/**
 * Home Page: Main landing page component for VisaTrack application.
 * Renders authentication gate and routes to appropriate dashboard based on user role.
 */

"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/design-system/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading VisaTrack...</div>
  ),
});

export default function Home() {
  return <App />;
}
