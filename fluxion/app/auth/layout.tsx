export const metadata = {
  title: 'Fluxion | AI Assistant for Change Management',
  description: 'Your AI-powered assistant to guide you through change.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
