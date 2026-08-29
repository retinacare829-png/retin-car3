# Checklist final de defensa

## Un día antes

- [ ] Confirmar que el repositorio está limpio y en la rama prevista.
- [ ] Verificar que `.env` local existe y no se proyectará ni compartirá.
- [ ] Ejecutar pruebas, build, secret scan y auditoría de dependencias.
- [ ] Preparar capturas de pantalla del flujo como plan B.
- [ ] Repasar [Guion de defensa](GUION_DEFENSA.md) y [Limitaciones](LIMITACIONES.md).
- [ ] Usar únicamente cuentas, pacientes e imágenes sintéticas demo.

## Preparar el entorno

- [ ] Abrir Docker Desktop y esperar que el motor esté listo.
- [ ] Verificar contenedores:

```powershell
docker ps
```

- [ ] Verificar Supabase:

```powershell
npx supabase status
```

- [ ] Si el escenario necesita restauración:

```powershell
npm run supabase:reset
npm run demo:storage
```

- [ ] Abrir Supabase Studio desde la URL reportada por `supabase status`.
- [ ] Iniciar la aplicación:

```powershell
npm run dev
```

- [ ] Abrir [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Ensayo funcional

- [ ] Probar login con una cuenta demo.
- [ ] Revisar que el Dashboard muestre KPIs, gráficas, actividad y agenda.
- [ ] Abrir el paciente `Mariana` / `DEMO-OFT-001`.
- [ ] Abrir el screening demo preparado.
- [ ] Verificar que OD y OI carguen y muestren la marca sintética.
- [ ] Registrar calidad y confirmar la notificación.
- [ ] Señalar el módulo IA `NOT_AVAILABLE`.
- [ ] Confirmar que revisión, seguimiento y referencia están disponibles según rol.
- [ ] Verificar checklist de cierre.
- [ ] Cerrar el screening si corresponde al ensayo.
- [ ] Volver al Dashboard y confirmar pendientes, revisados y actividad actualizados.
- [ ] Confirmar eventos en Timeline.
- [ ] Confirmar `audit_logs` en Supabase Studio sin mostrar datos sensibles.
- [ ] Después del ensayo, restaurar seed y Storage para dejar el caso abierto.

## Inmediatamente antes

- [ ] Cerrar notificaciones personales y aplicaciones ajenas.
- [ ] Usar zoom 100 % y una resolución legible.
- [ ] Mantener cargador y adaptador de video conectados.
- [ ] Dejar la app en login y la terminal sin secretos visibles.
- [ ] Abrir esta documentación en una ventana privada de apoyo.
- [ ] Recordar: no diagnostica, no sustituye al oftalmólogo y no tiene IA activa.

## Plan B

### Si Docker falla

- Mostrar capturas de pantalla preparadas.
- Explicar la arquitectura React → servicios → Supabase → PostgreSQL/RLS/Storage.
- Mostrar código y documentación, sin presentar el fallo como una operación exitosa.

### Si la aplicación no inicia

- Mostrar el último build aprobado y explicar la suite de QA.
- Recorrer el Manual de usuario y el Informe técnico.

### Si una imagen no carga

- Ejecutar `npm run demo:storage` y recargar una vez.
- Si persiste, mostrar la captura del visor y explicar Storage privado y URLs firmadas.
- No sustituirla por una imagen real.

### Si el flujo ya está cerrado

- Mostrar Timeline, Dashboard y auditoría desde los datos cargados.
- Si hay tiempo seguro, restaurar con `npm run supabase:reset` y `npm run demo:storage`.

### Evidencia alternativa

- Capturas de pantalla del flujo completo.
- Supabase Studio con tablas demo, RLS y auditoría.
- Código de dominio, servicios y función de cierre.
- Documentación de entrega y resultados de pruebas.

## Criterio de listo

La defensa está lista cuando login, Dashboard, paciente, screening, OD/OI, workflow, cierre, Timeline y auditoría se verifican; o cuando el plan B está preparado y permite explicar el mismo diseño con transparencia.
