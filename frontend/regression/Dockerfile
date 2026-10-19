FROM node:22.12-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN apk add --no-cache chromium

COPY playwright.regression.config.ts ./
COPY regression ./regression
COPY lib/api.ts ./lib/api.ts

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    REGRESSION_OUTPUT_DIR=/evidence/test-results \
    REGRESSION_REPORT_DIR=/evidence/report \
    REGRESSION_JSON_REPORT=/evidence/results.json

ENTRYPOINT ["node", "regression/run-docker.mjs"]
