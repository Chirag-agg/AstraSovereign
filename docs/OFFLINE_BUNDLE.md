# Offline Bundle

Everything required to run AstraSovereign on an air-gapped machine, and the
commands to move it there. Build the bundle on a connected machine, transfer it
by approved media, then verify on the target.

## 1. Container images

The code sandbox image is required for `code_execution`.

```
docker save workbench-sandbox:py312 -o offline/workbench-sandbox-py312.tar
# on the air-gapped machine:
docker load -i offline/workbench-sandbox-py312.tar
```

Verify:

```
docker run --rm --network none --memory 512m --pids-limit 128 --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m workbench-sandbox:py312 \
  python -c "import numpy, pandas, openpyxl; print('ok')"
```

## 2. Python dependencies (backend)

```
pip download -r backend/requirements.txt -d offline/wheels
# on the air-gapped machine:
pip install --no-index --find-links offline/wheels -r backend/requirements.txt
```

## 3. Node dependencies and frontend build

```
cd presentation && npm ci --cache ../offline/npm-cache --prefer-offline
cd ../frontend  && npm ci --cache ../offline/npm-cache --prefer-offline && npm run build
```

Ship `presentation/node_modules` (or the npm cache) and the built `frontend/.next`.

## 4. Local models (Ollama)

Required models: `qwen2.5-coder:3b` (text tasks), `llava:7b` (vision),
`nomic-embed-text` (embeddings). Transfer the Ollama models directory, or
re-create each model offline from a local GGUF/modelfile.

```
ollama list
```

## 5. Source and configuration

- Repository tarball (or a clean checkout).
- `config/models.yaml`.
- `backend/.env` (created from `backend/.env.example`); set `OLLAMA_BASE_URL`,
  `DEFAULT_MODEL`, and the sandbox settings for the target machine.

## 6. Verification checklist

- `ollama list` shows the three models.
- `docker images` shows `workbench-sandbox:py312`.
- The sandbox import check above prints `ok`.
- Backend starts and `/health` reports Ollama reachable and the models available.
- Frontend starts and a chat job completes.
