'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Compass, Sparkles, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface CompassProps {
  userName?: string
  hasActiveSubscription: boolean
}

export function LearningCompassUI({ userName, hasActiveSubscription }: CompassProps) {
  return (
    <div className="relative group overflow-hidden bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500 hover:border-cyan-500/50">
      
      {/* ── BACKGROUND GLOW EFFECT ── */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-600/10 rounded-full blur-[100px] group-hover:bg-cyan-500/20 transition-colors duration-700" />

      <div className="relative z-10 flex flex-col items-center text-center">
        
        {/* 🧭 THE ANIMATED COMPASS ICON */}
        <div className="relative mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            whileHover={{ scale: 1.1, transition: { duration: 0.3 } }}
            className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_50px_rgba(6,182,212,0.5)] transition-all duration-500"
          >
            <Compass className="w-10 h-10 text-white stroke-[2.5px]" />
          </motion.div>
          
          {/* Sparkle overlay for AI feel */}
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-6 h-6 text-cyan-300" />
          </motion.div>
        </div>

        {/* ── TEXT CONTENT ── */}
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
          Learning Compass
        </h3>
        <p className="text-slate-400 font-bold text-sm mb-8 max-w-[240px]">
          {hasActiveSubscription 
            ? `Navigating the best CBC paths for ${userName || 'your child'}.`
            : "Unlock AI-guided subject selection and career mapping."}
        </p>

        {/* ── ACTION BUTTON ── */}
        {hasActiveSubscription ? (
          <Link 
            href="/dashboard/compass" 
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 group/btn shadow-lg shadow-cyan-900/20"
          >
            Ask Compass
            <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <Link 
            href="/pricing" 
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-white/5"
          >
            <Lock className="w-4 h-4" />
            Unlock Feature
          </Link>
        )}
      </div>

      {/* Subtle bottom label */}
      <div className="mt-6 pt-6 border-t border-white/5 w-full text-center">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Powered by EduNexus AI
        </span>
      </div>
    </div>
  )
}