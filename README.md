# Singular - Gestión de Obras y Equipos

App de gestión de proyectos de obra con Firebase (datos compartidos en tiempo real).

## Requisitos previos

1. **Node.js** instalado (v18 o superior): https://nodejs.org
2. **Proyecto Firebase** ya creado (✅ hecho)

## Instalación paso a paso

### 1. Descomprime el ZIP y abre una terminal en la carpeta

```bash
cd singular-firebase
```

### 2. Instala las dependencias

```bash
npm install
```

### 3. Arranca en modo desarrollo (para probar en local)

```bash
npm run dev
```

Se abrirá en http://localhost:5173 — ¡ya puedes probar!

## Desplegar en internet (para que los empleados accedan)

### Opción A: Vercel (recomendada, la más fácil)

1. Crea cuenta en https://vercel.com (gratis con GitHub)
2. Sube este proyecto a un repositorio de GitHub
3. En Vercel, pulsa "New Project" → importa el repo
4. Vercel detectará Vite automáticamente → pulsa "Deploy"
5. En 1 minuto tendrás una URL tipo: `singular-obras.vercel.app`

### Opción B: Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting  (selecciona "dist" como carpeta pública)
npm run build
firebase deploy
```

## Crear el primer usuario Admin

1. Abre la app en el navegador
2. Rellena nombre, email y contraseña
3. Selecciona rol "Admin"
4. El primer usuario se registra directamente

## Cómo funciona

- **Los datos se sincronizan en tiempo real** entre todos los dispositivos
- **Cada empleado** tiene su propio login con email/contraseña
- **Admins** pueden crear proyectos, tareas, listas de compra
- **Empleados** pueden ver sus tareas, completarlas, añadir notas
- **Los planos** (PDF/CAD) se almacenan en Firebase Storage
- **Notificaciones** se generan automáticamente al completar tareas o añadir notas

## Para añadir en la pantalla de inicio del iPhone

1. Abre la URL en Safari
2. Pulsa el botón de compartir (cuadrado con flecha)
3. Selecciona "Añadir a pantalla de inicio"
4. La app se abrirá como si fuera una app nativa
