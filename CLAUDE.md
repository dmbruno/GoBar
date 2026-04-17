# GoBar - Email Masivo via Gmail

## Descripción del proyecto
App web para envío masivo de correos electrónicos por Gmail. El cliente (negocio GoBar - tienda de puntos) sube un Excel con sus contactos, escribe el correo, agrega una imagen opcional y envía masivamente.

## Arquitectura

### Backend (Flask) - `/backend/`
- **app.py**: API REST con 5 endpoints
  - `GET /api/health` - Health check + estado de config Gmail
  - `POST /api/parse-excel` - Parsea Excel/CSV, extrae columna Email + Nombre + Apellido, elimina duplicados
  - `POST /api/send` - Inicia envío masivo en background thread. Recibe subject, body, contacts (JSON), image (file)
  - `GET /api/job/<job_id>` - Polling del estado del job (progreso, enviados, fallidos, log)
  - `POST /api/job/<job_id>/cancel` - Cancela un job en curso
  - `POST /api/test-connection` - Testea conexión SMTP con Gmail

- **Envío de emails**: SMTP SSL (puerto 465) con `smtplib`. Usa App Password de Gmail. Delay de 2s entre envíos. Batch máximo de 450 (configurable).
- **Template HTML**: Email con header estilizado, imagen inline via CID attachment, footer con opción de desuscripción.
- **Personalización**: Soporta `{{nombre}}` en el cuerpo del correo.

### Frontend (React) - `/frontend/`
- **App.js**: Componente principal con 4 pasos (wizard):
  1. Cargar archivo (drag & drop o click) - soporta .xlsx, .xls, .csv
  2. Componer email (asunto, cuerpo con {{nombre}}, imagen opcional con preview)
  3. Enviando (barra de progreso en tiempo real, log de envíos, botón cancelar)
  4. Resultado (resumen de enviados/fallidos, detalle de errores)
- **Proxy**: El `package.json` tiene `"proxy": "http://localhost:5000"` para desarrollo
- **Estilos**: Dark theme, responsive, sin librerías CSS externas

### Config
- `.env` en backend con: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_DELAY`, `MAX_EMAILS_PER_BATCH`
- `REACT_APP_API_URL` en frontend para producción (apunta al backend en Render)

## Stack técnico
- Backend: Python 3.9+ / Flask / flask-cors / openpyxl / smtplib / gunicorn
- Frontend: React 18 / axios
- Deploy target: Render (free tier) — backend como Web Service, frontend como Static Site

## Cómo correr en desarrollo
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
python app.py  # Puerto 5000

# Terminal 2 - Frontend
cd frontend
npm start  # Puerto 3000 con proxy a 5000
```

## Datos del cliente
- El Excel del cliente tiene 540 filas, columnas: Nombre, Apellido, Email, Teléfono, DNI, Fecha nacimiento, Puntos, etc.
- Algunos contactos NO tienen email (se filtran automáticamente)
- Gmail personal del cliente → límite ~500 correos/día

## Convenciones
- Código y comentarios en español (es una app para cliente argentino)
- Los mensajes de error de la API van en español
- No hay autenticación/login — es una herramienta interna simple
- No hay base de datos — todo en memoria (jobs dict en app.py)

## Pendientes / posibles mejoras
- [ ] Instalar dependencias: `cd frontend && npm install` y `cd backend && pip install -r requirements.txt`
- [ ] Crear archivo `backend/.env` con credenciales reales del cliente
- [ ] Testear conexión SMTP antes del primer envío
- [ ] Deploy a Render (ver README.md para instrucciones)
- [ ] Agregar personalización con más campos del Excel (ej: {{apellido}}, {{puntos}})
- [ ] Agregar preview del email antes de enviar
- [ ] Agregar opción de envío de prueba (a un solo correo)
- [ ] Agregar soporte para archivos .numbers (formato Apple)
- [ ] Rate limiting más inteligente si el cliente sube a Google Workspace
