# Retina Care · Frontend premium

## Identidad y recursos

Implementación basada en el manual oficial de identidad v1.0 entregado en
`Retina-Care_Identidad-de-Marca.zip`. Se revisaron sus 31 páginas, aplicaciones
de marca, iconos, logos y tipografías. También se revisaron las cuatro imágenes
y una secuencia de fotogramas a lo largo del video de referencia (~50 segundos)
de `material visual.zip`.

- DM Sans para títulos; Lexend para interfaz y lectura. Fuentes locales, licencia
  OFL incluida en `public/brand/fonts/`; sin peticiones a servicios de fuentes.
- Verde `#456E68`, verde profundo `#2B4741`, verde sereno `#A3CFA0`, coral
  `#EDA69D`, ámbar `#E8C56A` y neutros del manual. Se conservan las paletas
  personalizadas por logo que ya admite cada clínica.
- Logos oficiales sin recorte ni alteración; ilustración retinal y órbitas
  oficiales utilizadas como decoración de marca, nunca como resultado clínico.
- Iconos oficiales mediante máscaras de color y Lucide existente para controles.
- Las referencias inspiran la jerarquía editorial, el contraste entre superficies
  y el movimiento medido; no se incorporaron fotografías externas ni el video
  pesado como fondo. El ZIP de CNN no se integra: este trabajo es solo frontend.

## Sistema y cobertura

`src/styles.css` organiza estilos por sistema, workspace, autenticación, inicio,
clínica, pantallas secundarias y compatibilidad con componentes antiguos.
Tokens compartidos de color, espacio, tipografía, radio, foco y transición.

Rediseñados: acceso y recuperación; navegación/cabecera; inicio con gráficos y
calendario; directorio y formularios de pacientes; screenings, captura, visor y
calidad; revisión, seguimiento, referencia, publicación y cierre; reportes;
configuración; portal del paciente (inicio, screenings, reportes y perfil).
Se mantienen los componentes de dashboard antiguos, sin añadir rutas nuevas.

Menú lateral fijo en escritorio y diálogo lateral en móvil, con Escape, control
de foco y ayuda por sección. Directorio primero en pantallas estrechas y acceso
directo al registro. Tablas extensas se desplazan dentro de su región. Estados
vacíos, carga, errores y mensajes usan la misma base visual. CSS y gráficos
respetan movimiento reducido; no hay animación permanente del logotipo.

## Verificación

- TypeScript, ESLint, 92 pruebas Vitest en 25 archivos, build de producción y
  escáner de secretos: completados sin errores.
- Navegador con backend local existente y cuenta ficticia de demo; sin crear,
  editar, archivar ni publicar registros. No se cambiaron cuentas, roles o RLS.
- Revisados login/recuperación y mostrar contraseña; búsqueda y selección de
  paciente; acceso al registro; screenings y workflow; tres tipos de gráfico;
  selección del calendario; configuración; pestañas y detalle de reportes.
- Viewports de 1440×900, 768×1024, 390×844 y 360×800. Corregido un
  desbordamiento causado por texto accesible absoluto dentro de la tabla de
  reportes. Sin errores/advertencias en la consola de la sesión revisada.
- Pruebas específicas para movimiento reducido, vista previa del logo guardado,
  retorno del foco en reportes y Escape en el menú.

Límites: el portal del paciente tiene pruebas de componentes, pero no se verificó
en navegador con una cuenta real vinculada (no existe una documentada en el seed
local). La impresión está cubierta por estilos y prueba del control, no por una
comparación visual de PDF. No se ejecutó una auditoría formal WCAG ni una prueba
de rendimiento Lighthouse. No se desplegó esta rama ni se alteró `dist-demo`.

No se agregaron dependencias. Sin cambios en servicios, migraciones, contratos,
autenticación o lógica de autorización.

## Abrir localmente

Desde la rama `codex/frontend-premium`, ejecutar `npm run dev` y abrir la URL
que indique Vite. La configuración de backend existente se conserva; los archivos
de entorno no se versionan. `npm run build` genera `dist`, y la demo hospedada
continúa utilizando el proceso separado `build:demo`/`dist-demo`.
