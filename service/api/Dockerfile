FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /srv/aduen

COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev && npm cache clean --force
COPY migrations ./migrations

USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
