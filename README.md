# RetinaCare

RetinaCare es una plataforma HealthTech B2B para organizar el flujo de tamizaje retinal en clínicas: registro de pacientes, screenings, imágenes OD/OI, control manual de calidad, revisión profesional, seguimiento, referencias, cierre y trazabilidad.

## Estado actual

El proyecto se encuentra en beta académica lista para demostración local. El Dashboard, los módulos clínicos y el Timeline operan con datos persistidos en Supabase. La demostración utiliza exclusivamente organizaciones, usuarios, pacientes e imágenes sintéticas.

> RetinaCare no diagnostica, no clasifica imágenes automáticamente y no sustituye al oftalmólogo. El módulo de inteligencia artificial no está implementado en esta beta.

## Tecnologías

- React 18, TypeScript y Vite.
- Supabase: PostgreSQL, Auth, Row Level Security y Storage privado.
- Zod para validación de entradas.
- Vitest y Testing Library para pruebas.
- Lucide React y CSS propio para la interfaz.

## Ejecución local

Requisitos: Node.js, npm, Docker Desktop y Supabase CLI.

1. Copiar `.env.example` como `.env` y completar únicamente los valores del entorno Supabase local.
2. Instalar dependencias e iniciar Docker Desktop:

```powershell
npm install
```

3. Preparar backend y datos ficticios:

```powershell
npx supabase start
npm run supabase:reset
npm run demo:storage
```

4. Iniciar la aplicación:

```powershell
npm run dev
```

5. Abrir [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Comandos básicos

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run secret:scan
npm audit
```

## Documentación

- [Índice de entrega académica](docs/entrega/README.md)
- [Informe técnico](docs/entrega/INFORME_TECNICO.md)
- [Manual de usuario](docs/entrega/MANUAL_USUARIO.md)
- [Seguridad y privacidad](docs/entrega/SEGURIDAD_Y_PRIVACIDAD.md)
- [Limitaciones](docs/entrega/LIMITACIONES.md)
- [Guion de defensa](docs/entrega/GUION_DEFENSA.md)
- [Checklist predefensa](docs/entrega/CHECKLIST_DEFENSA.md)

La documentación histórica y de ingeniería permanece disponible en `docs/`. Las decisiones internas de desarrollo se conservan transparentemente en `docs/interno/`.
