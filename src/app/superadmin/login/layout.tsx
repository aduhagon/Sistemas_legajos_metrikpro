// src/app/superadmin/login/layout.tsx
// Override del layout padre — el login no necesita sidebar ni verificación de sesión

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
