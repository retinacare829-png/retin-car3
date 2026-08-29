# Checklist pre-defensa — RetinaCare

## Un día antes

- [ ] Usar únicamente el seed y cuentas ficticias de demostración.
- [ ] Confirmar que `.env` existe localmente, no está versionado y contiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del entorno demo.
- [ ] Confirmar espacio disponible, cargador, adaptador de video y navegador actualizado.
- [ ] Aplicar el seed desde cero en el entorno local desechable.
- [ ] Ejecutar `npm run demo:storage` después del reset y comprobar los dos mensajes `OK`.
- [ ] Abrir Supabase Studio y verificar organizaciones, pacientes, screenings, Timeline y auditoría.
- [ ] Verificar que ninguna pestaña o terminal muestre secretos.

## Comandos obligatorios

Ejecutar desde la raíz del repositorio:

```powershell
docker ps
npx supabase status
npm run dev
npm test
npm run build
npm run demo:storage
```

Validación adicional recomendada:

```powershell
npm run typecheck
npm run lint
npm run secret:scan
npm audit
```

## Treinta minutos antes

- [ ] Verificar `.env` sin proyectarlo ni copiar sus valores.
- [ ] Confirmar que Docker y Supabase local están activos.
- [ ] Confirmar que Supabase Studio abre y que el seed tiene dos clínicas.
- [ ] Iniciar Vite y abrir `http://127.0.0.1:5173`.
- [ ] Verificar login con `admin.demo@example.test`.
- [ ] Confirmar que el Dashboard carga KPIs, actividad y agenda.
- [ ] Buscar `Mariana` / `DEMO-OFT-001`.
- [ ] Confirmar que el screening preparado muestra OD/OI y calidad.
- [ ] Confirmar que los archivos sintéticos marcados como no diagnósticos existen físicamente en Storage y abren con URL firmada.
- [ ] Confirmar el bloque de IA `NOT_AVAILABLE`.
- [ ] Verificar el flujo paciente → screening → workflow → Dashboard.
- [ ] Confirmar que Timeline y auditoría contienen eventos.
- [ ] Completar y cerrar el caso en un ensayo; después ejecutar `npm run supabase:reset` y `npm run demo:storage` para restaurar el escenario.
- [ ] Dejar abierta una terminal con `docker ps` y otra con Vite, sin secretos visibles.

## Justo antes de presentar

- [ ] Cerrar notificaciones personales y aplicaciones ajenas a la defensa.
- [ ] Ajustar zoom del navegador al 100 % y resolución legible.
- [ ] Iniciar en la pantalla de login, sin sesión previa.
- [ ] Tener abierta `docs/DEFENSA_DEMO.md` como apoyo privado.
- [ ] Recordar: RetinaCare no diagnostica, no sustituye al oftalmólogo y la IA es futura.
- [ ] Tener listo el plan B para Supabase, internet e imágenes.

## Criterio de salida

No iniciar la defensa práctica si falla el login, el Dashboard no carga o `npm run demo:storage` no valida OD/OI. En ese caso, usar el plan B documentado y declarar con transparencia el estado del entorno.
