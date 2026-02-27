"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/figma/App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading VisaTrack...</div>
  ),
});

export default function Home() {
  return <App />;
}
