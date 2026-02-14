import { ToastProvider } from '@/components/toast-system' // Import hapa

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main>{children}</main>
        
        {/* Hapa sasa ndio Toast itakaa tayari kurusha alerts */}
        <ToastProvider /> 
      </body>
    </html>
  )
}
