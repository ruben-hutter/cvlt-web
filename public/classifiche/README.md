# Classifiche

PDF delle classifiche annuali del Campionato ticinese di Hike & Fly, serviti da Next.js
come file statici a `/classifiche/<nome-file>`.

## Come pubblicare una classifica

1. Compilare il PDF nella cartella typst su kDrive (`Para/CVLT/gare/<anno>/`,
   vedere `Para/CVLT/gare/TASK.md`).
2. Copiarlo qui con il naming `classifica-<anno>.pdf` (es. `classifica-2026.pdf`).
3. Aggiungere (o aggiornare) la voce corrispondente nell'array `classifiche`
   in `src/app/(frontend)/gare/GareContent.tsx`.

Nessun riavvio necessario: i file in `public/` vengono serviti così come sono.
