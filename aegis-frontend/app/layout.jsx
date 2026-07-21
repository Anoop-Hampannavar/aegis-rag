import './globals.css'

export const metadata = {
  title: 'Aegis-RAG | Enterprise Document Intelligence',
  description: 'Self-Correcting RAG System with Hardware Fallback & GDPR Compliance',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#090d16" />
      </head>
      <body>{children}</body>
    </html>
  )
}