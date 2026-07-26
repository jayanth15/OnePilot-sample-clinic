.PHONY: dev test install

install:
	uv pip install -r requirements.txt

dev:
	uv run python -m app

test:
	uv run python -m unittest discover -s tests -v
