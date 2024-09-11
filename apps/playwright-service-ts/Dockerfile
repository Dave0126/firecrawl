FROM node:18-slim

# 对于容器镜像，从 Debian 12 开始，其软件源配置文件变更为 DEB822 格式，路径为 /etc/apt/sources.list.d/debian.sources。一般情况下，将对应文件中 Debian 默认的源地址 http://deb.debian.org/ 替换为镜像地址即可。
RUN sed -i "s@http://deb.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources

RUN mkdir -p /usr/src/app
COPY . /usr/src/app

WORKDIR /usr/src/app

RUN npm config set registry https://registry.npmmirror.com/
RUN npm install

# Install Playwright dependencies
RUN npx playwright install --with-deps

RUN npm run build

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD [ "npm", "start" ]
