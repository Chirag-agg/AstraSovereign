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

The presentation renderer's full PptxGenJS dependency closure is committed under
`presentation/node_modules`, so deck generation needs no npm registry on the
air-gapped machine. Verify the vendored tree in place (no network, no npm):

```
node presentation/scripts/install-offline.cjs
```

The frontend still needs npm to build. Build it on a connected machine and ship
the output:

```
cd frontend && npm ci && npm run build
# ship frontend/.next (and frontend/node_modules if the target runs `next start`)
```

## 4. Local models (Ollama)

Required models: `gpt-oss:20b` (general tasks), `qwen3-vl:latest` (document and
vision tasks), `devstral:24b` (coding), `deepseek-r1:14b` (math), and
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

## 6. Demo history backup

The SQLite database holds job, artifact, and audit history and is gitignored.
Back it up (and restore it) like any other bundle artifact:

```
sqlite3 data/astra.db ".backup 'offline/astra-backup.db'"
# restore:
#   stop the backend, replace data/astra.db, restart
```

## 7. Verification checklist

- `ollama list` shows the three models.
- `docker images` shows `workbench-sandbox:py312`.
- The sandbox import check above prints `ok`.
- `node presentation/scripts/install-offline.cjs` prints `{"ok":true,...}`.
- A deck renders with only local Node deps:
  `node presentation/src/render.cjs --in offline/sample-deck.json --out offline/sample-deck.pptx`.
- Backend starts and `/health` reports Ollama reachable and the models available.
- Frontend starts and a chat job completes.
