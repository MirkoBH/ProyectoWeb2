# AutoMarket Frontend - Parte 1

Esta entrega incluye una landing funcional con Bootstrap + JavaScript vanilla (sin frameworks de UI), orientada a probar la experiencia inicial de busqueda y comparacion.

## Incluye en esta parte

- Landing con estilo definido en promptDiseno (paleta rojo/negro/grises, glassmorphism suave, cards redondeadas).
- Navbar con secciones: Inicio, Explorar, Publicar, Login, Registro, Contacto.
- Selector de idioma ES/EN.
- Selector de rol demo Buyer/Seller para probar visibilidad de Publicar.
- Busqueda rapida en hero.
- Barra de filtros (desktop) y drawer de filtros (mobile).
- Boton para limpiar filtros.
- Listado de publicaciones con estado IA.
- Seleccion de autos para comparar (maximo 4).
- Comparador en modal (tabla lado a lado).
- Lista de deseados y comparacion desde deseados.

## Estructura usada

- public/index.html
- public/src/css/styles.css
- public/src/js/i18n.js
- public/src/js/data.js
- public/src/js/app.js
- public/src/data/car-brands.json
- public/src/data/provinces.json

## Como probar localmente

No abras `index.html` con doble click (file://), porque `fetch` de JSON puede fallar.
Levanta un servidor local desde `frontend/public`.

### Opcion A (Python)

```bash
cd frontend/public
python -m http.server 5500
```

Abrir: http://localhost:5500

### Opcion B (Node, si tienes npx)

```bash
cd frontend/public
npx serve -l 5500
```

Abrir: http://localhost:5500

## Flujos de prueba recomendados

1. Verificar idioma ES/EN en navbar.
2. Cambiar rol a Seller y confirmar que aparece `Publicar`.
3. Buscar desde hero por marca/modelo y confirmar scroll a resultados.
4. Aplicar filtros en panel lateral y luego limpiar filtros.
5. Seleccionar 2 a 4 autos y usar `Comparar seleccionados`.
6. Guardar autos en deseados y comparar desde `Deseados`.

## Limites actuales (esperados en Parte 1)

- Login/registro todavia no estan conectados a backend.
- Publicar auto todavia no abre formulario real.
- Datos de autos son mock locales para validar UI y logica.

## Siguiente parte

- NestJS backend base (auth JWT + usuarios + autos CRUD).
- Conexion a Supabase Postgres.
- Integracion de imagenes en Supabase Storage (limite 2MB por imagen).
- Migrar frontend para consumir API real.
