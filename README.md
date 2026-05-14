# Sistema de Gestión de Legajos y Control de Acceso

**MétrikPro** — Consultoría en Optimización de Procesos

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend / DB**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Hosting**: Vercel
- **IA (Fase 2)**: Claude API (Anthropic)

## Setup local

```bash
# 1. Clonar el repo
git clone https://github.com/TU-ORG/sistema-legajos.git
cd sistema-legajos

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Completar con los valores de tu proyecto Supabase

# 4. Correr en desarrollo
npm run dev
```

## Variables de entorno

Ver `.env.example`.

## Estructura del proyecto

```
src/
├── app/
│   ├── login/          # Autenticación usuarios internos
│   ├── registro/       # Portal público autoregistro proveedores
│   ├── dashboard/      # Panel principal (post-login)
│   └── auth/callback/  # Handler OAuth Supabase
├── lib/
│   ├── auth.ts         # Helpers de sesión y roles
│   ├── supabase-client.ts  # Cliente browser
│   └── supabase-server.ts  # Cliente server (SSR)
├── components/         # Componentes reutilizables
└── middleware.ts       # Protección de rutas
```

## Fases de desarrollo

| Fase | Duración | Estado |
|------|----------|--------|
| Fase 1 — MVP Core | 8 semanas | 🟡 En progreso |
| Fase 2 — IA + Georeferenciación | 4 semanas | ⏳ Pendiente |
| Fase 3 — Auditoría y reporting | 3 semanas | ⏳ Pendiente |
| Fase 4 — Integración ERP | A definir | ⏳ Pendiente |

## Módulos MVP

- **M1** — Autoregistro del proveedor (portal público `/registro`)
- **M2** — Gestión documental (carga PDF + fechas de vencimiento)
- **M3** — Evaluación del legajo (humana + IA en Fase 2)
- **M4** — Habilitación y carnet QR dinámico
- **M5** — Control de acceso georeferencial (PWA)
- **M6** — Log de auditoría inmutable
