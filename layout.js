export const metadata = {
  title: 'Mr. Better Boss ⚡ | AI JobTread Assistant',
  description: 'Your AI implementation guide for JobTread. Get instant answers on estimates, workflows, automations & best practices. Built by Better Boss.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
