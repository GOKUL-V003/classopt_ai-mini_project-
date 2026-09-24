import "./globals.css";

export const metadata = {
  title: "SmartOccupy AI - Classroom Resource Optimizer",
  description: "AI-Powered Classroom Resource Optimization System built with React and Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
