# Bonos - contexto del proyecto

Bonos es una webapp de mercado para analizar bonos argentinos, LECAPs, datos BCRA, tasas, cauciones y series historicas cargadas por el usuario.

La estructura actual es conservadora:

- Backend: Python con FastAPI.
- Frontend: HTML, CSS y JavaScript estatico.
- Persistencia: SQLite via `APP_DB_PATH`.
- Frontend servido por FastAPI desde `frontend/index.html` y `/static`.

No hay Next.js, React, TypeScript, Tailwind, Vite ni `package.json`.

Los datos cargados por el usuario viven en SQLite local, normalmente `data/user_data.db`, y no deben guardarse en el repositorio.
