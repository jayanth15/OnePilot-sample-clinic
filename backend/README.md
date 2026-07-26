# OnePilot backend

Standalone FastAPI service.

## Structure

- `app/api`: versioned HTTP routes
- `app/core`: settings and configuration
- `tests`: API tests

## Setup

```bash
uv venv
uv pip install -r requirements.txt
```

## Run

Any of these from `backend/`:

```bash
uvicorn app:app --reload --host 0.0.0.0   # standard
python -m app                              # via __main__.py
make dev                                   # convenience
```

OpenAPI is available at `http://localhost:8000/docs`.

## Test

```bash
make test
# or
uv run python -m unittest discover -s tests -v
```
