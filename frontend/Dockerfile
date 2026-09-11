FROM node:22.12-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.12-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:22.12-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup --system --gid 10001 visatrack \
    && adduser --system --uid 10001 --ingroup visatrack visatrack
COPY --from=builder --chown=visatrack:visatrack /app/public ./public
COPY --from=builder --chown=visatrack:visatrack /app/.next ./.next
COPY --from=builder --chown=visatrack:visatrack /app/package.json ./package.json
COPY --from=production-dependencies --chown=visatrack:visatrack /app/node_modules ./node_modules
USER visatrack
EXPOSE 3000
CMD ["npm", "run", "start"]
