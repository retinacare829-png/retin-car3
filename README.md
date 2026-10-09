# RetinaCare

RetinaCare es una plataforma HealthTech B2B para organizar el flujo de tamizaje retinal en clínicas: registro de pacientes, screenings, imágenes OD/OI, control manual de calidad, revisión profesional, seguimiento, referencias, cierre y trazabilidad.

## Estado actual

El proyecto está en beta académica. La web se publicó en [retinacare-hackathon.pages.dev](https://retinacare-hackathon.pages.dev/) con Supabase hospedado; el Dashboard, los módulos clínicos y el Timeline usan datos persistidos. La demostración utiliza exclusivamente organizaciones, usuarios, pacientes e imágenes sintéticas. La validación completa de login y escritura desde un dispositivo externo sigue documentada como pendiente.

> RetinaCare no diagnostica ni sustituye al oftalmólogo. Incluye una CNN experimental TensorFlow.js en el navegador y un anexo de resultados que requiere aprobación profesional. Sus puntuaciones no están validadas clínicamente; no deben presentarse como un diagnóstico o decisión autónoma.

## Tecnologías

- React 18, TypeScript y Vite.
- Supabase: PostgreSQL, Auth, Row Level Security y Storage privado.
- Zod para validación de entradas.
- Vitest y Testing Library para pruebas.
- Lucide React y CSS propio para la interfaz.
- TanStack Charts para los gráficos del dashboard.

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

- [Demo pública, despliegue y evidencia de entregables](docs/DESPLIEGUE_CLOUDFLARE_PAGES.md)
- [Índice de entrega académica](docs/entrega/README.md)
- [Informe técnico](docs/entrega/INFORME_TECNICO.md)
- [Manual de usuario](docs/entrega/MANUAL_USUARIO.md)
- [Seguridad y privacidad](docs/entrega/SEGURIDAD_Y_PRIVACIDAD.md)
- [Limitaciones](docs/entrega/LIMITACIONES.md)
- [Guion de defensa](docs/entrega/GUION_DEFENSA.md)
- [Checklist predefensa](docs/entrega/CHECKLIST_DEFENSA.md)

La documentación histórica y de ingeniería permanece disponible en `docs/`. Las decisiones internas de desarrollo se conservan transparentemente en `docs/interno/`.

## Créditos visuales

Las animaciones de carpeta, esfera de procesamiento y campana son adaptaciones de
[Rare UI](https://rareui.com), Copyright (c) 2026 Swami Malode, realizadas con CSS/SVG
sin dependencias adicionales. Se conserva su licencia MIT + Commons Clause +
Attribution en [RARE_UI_LICENSE.txt](docs/RARE_UI_LICENSE.txt).
Los contratos de integración y las diferencias de estas adaptaciones están en
[ANIMATED_VISUALS.md](docs/ANIMATED_VISUALS.md).
