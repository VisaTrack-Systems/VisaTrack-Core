# Contributing

Thanks for contributing to VisaTrack.

## Workflow

1. Create a feature branch from `develop`.
2. Open a PR back to `develop`.
3. Ensure CI checks pass before requesting review.

## Local Checks

Frontend:

```bash
cd frontend
npm ci
npm run build
npm test
```

Backend:

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip install -r requirements-dev.txt
pytest
```

## Pull Requests

- Keep PRs focused and reasonably sized.
- Update documentation when behavior or configuration changes.
- Add or update tests when possible.
