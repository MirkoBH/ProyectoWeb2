# Documentación Histórica y Técnica del Proyecto AutoMarket

## 1. Resumen del Proyecto

AutoMarket es una plataforma fullstack para publicación y gestión de autos usados, con autenticación por email, roles de usuario (comprador/vendedor), carga de imágenes, y lógica de negocio robusta. El stack incluye:
- **Frontend:** Vanilla JS, Bootstrap, HTML, CSS, i18n, asincronía, modales de auth, feedback UI.
- **Backend:** NestJS, TypeORM, PostgreSQL (Supabase), JWT, CORS, configuración por .env.
- **Storage:** Supabase Storage para imágenes.
- **DevOps:** Scripts para gestión de puertos, http-server para frontend, automatización de procesos.

## 2. Plan y Evolución del Proyecto

### Objetivos iniciales
- UI/UX fluida (navbar, transiciones, feedback inmediato).
- Registro/login/recupero de contraseña con Supabase Auth.
- Backend robusto, seguro y desacoplado de la lógica de autenticación.
- Carga y visualización de imágenes asociadas a publicaciones.
- Arquitectura escalable y mantenible.

### Hitos y Cambios Clave
- **Navbar y UX:** Mejoras visuales, glass effect, transiciones suaves.
- **Async y performance:** Carga asíncrona, hydration en background, feedback de carga.
- **Password recovery:** Página y lógica de recuperación de contraseña usando Supabase.
- **CORS:** Soporte para múltiples orígenes de desarrollo y producción.
- **Backend:**
  - Migración de auth local a Supabase Auth (manteniendo tabla local de usuarios para lógica de dominio).
  - Mejoras en manejo de errores y mensajes claros para el usuario.
  - Automatización de limpieza de puertos y procesos en desarrollo.
- **Registro:**
  - Registro desacoplado del login (requiere confirmación de email, no auto-login).
  - Validación estricta de roles y datos.
- **Imágenes:**
  - Arquitectura migrada a Supabase Storage.
  - Implementación de tabla car_images para asociar imágenes a publicaciones.
  - Eliminación de image_urls de la tabla cars.
- **Confirmación de email:**
  - Configuración de Site URL en Supabase para que los links de confirmación apunten al frontend.
  - Página confirm.html para procesar la confirmación y mostrar feedback al usuario.

## 3. Problemas Encontrados y Soluciones

- **Conflictos de puertos/backend ocupado:**
  - Solución: Scripts para matar procesos y limpiar puertos automáticamente.
- **CORS y orígenes múltiples:**
  - Solución: Configuración de CORS_ORIGIN en .env para todos los orígenes de desarrollo y producción.
- **Error “Invalid API key” en registro:**
  - Solución: Verificación y copia exacta de SUPABASE_ANON_KEY y SUPABASE_URL desde el panel de Supabase.
- **Roles incorrectos en registro:**
  - Solución: Validación estricta en backend y frontend para enviar solo buyer/seller.
- **Confirmación de email apunta a localhost:3000:**
  - Solución: Cambiar Site URL en Supabase a la URL real del frontend.
- **Error 500 por columna image_urls faltante:**
  - Solución: Migración a tabla car_images y eliminación de image_urls de cars.
- **Carga de imágenes:**
  - Solución: Uso de Supabase Storage y relación en base de datos mediante car_images.

## 4. Estado Actual

- **Frontend:**
  - Registro, login, recuperación de contraseña y confirmación de email funcionando.
  - Publicación de autos con carga de imágenes a Supabase Storage.
  - Visualización de autos y sus imágenes.
- **Backend:**
  - Endpoints robustos para auth, autos y carga de imágenes.
  - Lógica desacoplada y validaciones estrictas.
  - Integración con Supabase Auth y Storage.
- **Base de datos:**
  - Tablas users, cars, car_images correctamente migradas.
- **DevOps:**
  - Scripts y documentación para levantar frontend y backend, limpiar puertos, y configurar .env.

## 5. Recomendaciones para Nuevos Desarrolladores

- Leer este documento antes de modificar el proyecto.
- Verificar siempre las claves y URLs de Supabase en .env.
- Para producción, cambiar la Site URL de Supabase al dominio real del frontend.
- Usar la tabla car_images y Supabase Storage para toda gestión de imágenes.
- Mantener la validación estricta de roles y datos en backend y frontend.
- Consultar la documentación de Supabase para cambios en autenticación o storage.

## 6. Recursos y Archivos Clave

- **backend/.env.example:** Plantilla de configuración.
- **backend/sql/01_schema.sql:** Esquema de base de datos recomendado.
- **frontend/public/confirm.html:** Página de confirmación de email.
- **frontend/public/src/js/app.js:** Lógica principal del frontend.
- **backend/src/auth/auth.service.ts:** Lógica de autenticación y registro.
- **backend/src/database/entities/car-image.entity.ts:** Modelo de imágenes asociadas a autos.

---

Este documento resume el historial, decisiones y arquitectura del proyecto. Cualquier asistente de IA o desarrollador puede consultarlo para entender el estado, los problemas resueltos y las mejores prácticas del sistema.
