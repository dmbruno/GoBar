# GoBar - Email Masivo

App para envío masivo de correos por Gmail. Subís un Excel con contactos, escribís el correo, agregás una imagen y enviás.

## Requisitos previos

- Python 3.9+
- Node.js 18+
- Cuenta Gmail con verificación en 2 pasos activada

## Configurar App Password de Gmail

1. Ir a https://myaccount.google.com/security
2. Activar **Verificación en 2 pasos** (si no la tenés)
3. Ir a https://myaccount.google.com/apppasswords
4. Crear una nueva App Password (nombre: "GoBar" o similar)
5. Copiar la contraseña de 16 caracteres generada

## Setup Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt

# Crear archivo .env (copiar de .env.example)
cp .env.example .env
# Editar .env con tus credenciales de Gmail
```

## Setup Frontend

```bash
cd frontend
npm install
```

## Ejecutar en desarrollo

Terminal 1 (backend):
```bash
cd backend
source venv/bin/activate
python app.py
```

Terminal 2 (frontend):
```bash
cd frontend
npm start
```

El frontend se abre en http://localhost:3000 y hace proxy al backend en :5000.

## Deploy en Render

### Backend (Web Service)
1. Crear nuevo Web Service en Render
2. Conectar repo, seleccionar carpeta `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. Agregar variables de entorno: `GMAIL_USER`, `GMAIL_APP_PASSWORD`

### Frontend (Static Site)
1. Crear nuevo Static Site en Render
2. Conectar repo, seleccionar carpeta `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `build`
5. Agregar variable: `REACT_APP_API_URL=https://tu-backend.onrender.com`

## Formato del Excel

El archivo debe tener al menos una columna con encabezado **Email** (o "Correo", "E-mail", "Mail").
Opcionalmente puede tener **Nombre** y **Apellido** para personalizar los correos.

## Límites de Gmail

- **Gmail personal**: ~500 correos/día
- **Google Workspace**: ~2000 correos/día
- La app envía con un delay de 2 segundos entre correos para evitar bloqueos
- Máximo por batch configurable (default 450)
