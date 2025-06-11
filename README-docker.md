# Docker per Audiolibri Editor

Questo documento fornisce istruzioni su come eseguire l'applicazione Audiolibri Editor utilizzando Docker e Docker Compose.

## Prerequisiti

- Docker installato sul tuo sistema
- Docker Compose installato sul tuo sistema

## Configurazione

Prima di avviare l'applicazione, assicurati di configurare le variabili d'ambiente necessarie. Puoi farlo in due modi:

1. Utilizzando il file `.env` esistente (già configurato)
2. Passando le variabili d'ambiente direttamente a Docker Compose

### Variabili d'ambiente richieste

```
GITHUB_TOKEN=il_tuo_token_github
REPO_OWNER=fabriziosalmi
REPO_NAME=audiolibri
PORT=3000
```

## Avvio dell'applicazione

Per avviare l'applicazione, esegui il seguente comando nella directory principale del progetto:

```bash
docker-compose up -d
```

Questo comando costruirà l'immagine Docker (se non esiste già) e avvierà il container in modalità detached (in background).

## Accesso all'applicazione

Una volta avviato il container, puoi accedere all'applicazione nel tuo browser all'indirizzo:

```
http://localhost:3000
```

## Visualizzazione dei log

Per visualizzare i log dell'applicazione in esecuzione:

```bash
docker-compose logs -f
```

## Arresto dell'applicazione

Per fermare l'applicazione:

```bash
docker-compose down
```

## Ricostruzione dell'immagine

Se hai apportato modifiche al codice e desideri ricostruire l'immagine Docker:

```bash
docker-compose build
```

Oppure per ricostruire e riavviare in un unico comando:

```bash
docker-compose up -d --build
```

## Note sulla sicurezza

- Il file `.env` contiene informazioni sensibili come il token GitHub. Assicurati che questo file non venga condiviso pubblicamente o incluso nei repository Git.
- Il token GitHub dovrebbe avere solo i permessi minimi necessari per funzionare con l'applicazione.

## Risoluzione dei problemi

Se riscontri problemi con l'applicazione in Docker:

1. Verifica che le variabili d'ambiente siano configurate correttamente
2. Controlla i log del container per eventuali errori
3. Assicurati che la porta 3000 non sia già in uso da un'altra applicazione