# Ritmo

PWA simple para registrar peso corporal, horas de ayuno y notas diarias desde el iPhone.

## Probar en la computadora

1. Abrir PowerShell en esta carpeta.
2. Ejecutar:

```powershell
node dev-server.js
```

3. Abrir `http://127.0.0.1:5173`.

Para cortar el servidor, presionar `Ctrl + C`.

## Publicar gratis

### Opcion recomendada: Netlify Drop

1. Entrar a `https://app.netlify.com/drop`.
2. Arrastrar esta carpeta completa al navegador.
3. Netlify crea una URL HTTPS gratis.
4. Abrir esa URL desde Safari en el iPhone.
5. Tocar compartir y elegir `Agregar a inicio`.

### Opcion para practicar Git: GitHub Pages

1. Crear un repositorio nuevo en GitHub.
2. Subir estos archivos al repositorio.
3. Ir a `Settings` > `Pages`.
4. En `Build and deployment`, elegir `Deploy from a branch`.
5. Seleccionar la rama `main` y carpeta `/root`.
6. Abrir la URL publicada desde Safari en el iPhone.
7. Tocar compartir y elegir `Agregar a inicio`.

## Guardar datos en Netlify

Esta version incluye una Netlify Function en `netlify/functions/entries.mjs`.
La funcion guarda tus registros en Netlify Blobs y los protege con una clave privada.

Para que esto funcione, conviene publicar desde GitHub en Netlify:

1. Crear un repositorio en GitHub.
2. Subir todos estos archivos al repositorio.
3. En Netlify, crear un sitio desde `Add new site` > `Import an existing project`.
4. Elegir GitHub y seleccionar el repositorio.
5. En la configuracion del sitio, ir a `Site configuration` > `Environment variables`.
6. Crear una variable:

```text
RITMO_SYNC_KEY=una-clave-larga-que-solo-vos-sepas
```

7. Hacer un nuevo deploy.
8. Abrir la app, tocar `Sincronizar` e ingresar la misma clave.

Netlify Drop es muy practico para probar la app estatica, pero para usar funciones y almacenamiento en la nube es mejor conectarla a GitHub o desplegar con Netlify CLI.

## Notas importantes

- Los datos se guardan primero en el dispositivo usando `localStorage`.
- Si configuraste `RITMO_SYNC_KEY`, tambien se sincronizan con Netlify.
- Sin esa variable, la app sigue funcionando localmente pero no puede guardar en la nube.
- El boton `Exportar CSV` sirve para guardar una copia y analizarla despues en Excel, Google Sheets o Python.
- Para que sea instalable como PWA en iPhone, la web publicada debe usar HTTPS. Netlify, Vercel y GitHub Pages ya lo incluyen gratis.

## Ideas para la siguiente version

- Objetivo de peso y rango saludable.
- Grafico de promedio movil de 7 dias.
- Etiquetas como entrenamiento, descanso, alcohol, sal o ciclo de sueño.
- Backup en Google Sheets o Supabase.
- Login para sincronizar entre dispositivos.
