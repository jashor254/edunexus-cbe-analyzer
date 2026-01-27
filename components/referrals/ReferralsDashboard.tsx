'use client';

import React from 'react';

// LAZIMA hii interface iwe na userName ndipo page.tsx ikubali
interface ReferralDashboardProps {
  userId: string;
  userName?: any; // Ongeza hii line hapa!
}

export default function ReferralsDashboard({ userId, userName }: ReferralDashboardProps) {
  const greeting = userName 
    ? `Welkam, Parent ${userName.split(' ')[0]}` 
    : "Habari, Mzazi Mwenzetu";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50">
      <h2 className="text-2xl font-bold text-gray-800">
        {greeting} ✨
      </h2>
      <p className="text-gray-600 mt-2">
        Asante kwa kuwa sehemu ya safari ya elimu ya mwanao. 
        Shirikisha wazazi wengine na upate zawadi ya AI tokens!
      </p>
    </div>
  );
}