import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'
import { Bot } from 'lucide-react'
import { QueryProvider } from '@/components/QueryProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Minesweeper Battle',
  description: 'Minesweeper LLM Arena',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-900 text-slate-50 antialiased`}
      >
        <QueryProvider>
          <NuqsAdapter>
            <header className="flex items-center justify-between border-b border-slate-700 px-10 py-6">
              <Link href="/setup" className="group flex items-center gap-2 text-2xl font-bold">
                <Bot className="text-blue-500 group-hover:text-white" size={32} />
                <span className="text-2xl font-bold group-hover:text-blue-500">
                  Minesweeper LLM Arena
                </span>
              </Link>
              <nav className="flex items-center gap-8">
                <Link
                  href="/human"
                  className="rounded-md px-4 py-2 font-bold text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
                >
                  Play as Human
                </Link>
                <Link
                  href="/setup"
                  className="rounded-md px-4 py-2 font-bold text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
                >
                  Setup LLM Game
                </Link>
                <Link
                  href="/history"
                  className="rounded-md px-4 py-2 font-bold text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-white"
                >
                  History
                </Link>
              </nav>
            </header>
            {children}
          </NuqsAdapter>
        </QueryProvider>
      </body>
    </html>
  )
}
