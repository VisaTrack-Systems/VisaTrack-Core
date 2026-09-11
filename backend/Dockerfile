FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/visatrack/.local/bin:${PATH}"

RUN apt-get update \
    && apt-get install --no-install-recommends -y clamav curl tini \
    && (freshclam || true) \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 visatrack
WORKDIR /app

COPY requirements.lock .
RUN python -m pip install --no-cache-dir --require-hashes -r requirements.lock

COPY --chown=visatrack:visatrack . .
USER visatrack

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
