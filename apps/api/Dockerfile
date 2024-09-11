FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
LABEL fly_launch_runtime="Node.js"
RUN corepack enable

RUN mkdir -p /app
COPY . /app
WORKDIR /app

# 对于容器镜像，从 Debian 12 开始，其软件源配置文件变更为 DEB822 格式，路径为 /etc/apt/sources.list.d/debian.sources。一般情况下，将对应文件中 Debian 默认的源地址 http://deb.debian.org/ 替换为镜像地址即可。
RUN sed -i "s@http://deb.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources

RUN echo "registry=http://registry.npmmirror.com/" > ~/.npmrc
# RUN pnpm config set registry http://registry.npmmirror.com/
# RUN pnpm config get registry

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store npm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store npm install --frozen-lockfile

RUN apt-get update -qq && apt-get install -y ca-certificates && update-ca-certificates

RUN npm install
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    bash -c 'export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; if [ -z $SENTRY_AUTH_TOKEN ]; then pnpm run build:nosentry; else pnpm run build; fi'

# Install Go
FROM golang:1.19 AS go-base
COPY src/lib/go-html-to-md /app/src/lib/go-html-to-md

# Install Go dependencies and build parser lib
RUN cd /app/src/lib/go-html-to-md && \
    go mod tidy && \
    go build -o html-to-markdown.so -buildmode=c-shared html-to-markdown.go && \
    chmod +x html-to-markdown.so

FROM base
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y chromium chromium-sandbox && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app /app
COPY --from=go-base /app/src/lib/go-html-to-md/html-to-markdown.so /app/dist/src/lib/go-html-to-md/html-to-markdown.so

# Start the server by default, this can be overwritten at runtime
EXPOSE 8080
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"