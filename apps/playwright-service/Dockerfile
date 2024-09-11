FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# 对于容器镜像，从 Debian 12 开始，其软件源配置文件变更为 DEB822 格式，路径为 /etc/apt/sources.list.d/debian.sources。一般情况下，将对应文件中 Debian 默认的源地址 http://deb.debian.org/ 替换为镜像地址即可。
RUN sed -i "s@http://deb.debian.org@http://mirrors.aliyun.com@g" /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libstdc++6

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./

# Remove py which is pulled in by retry, py is not needed and is a CVE
# config pip mirror source
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/

RUN pip install --no-cache-dir --upgrade -r requirements.txt && \
    pip uninstall -y py && \
    playwright install chromium && playwright install-deps chromium && \
    ln -s /usr/local/bin/supervisord /usr/bin/supervisord

# Cleanup for CVEs and size reduction
# https://github.com/tornadoweb/tornado/issues/3107
# xserver-common and xvfb included by playwright installation but not needed after
# perl-base is part of the base Python Debian image but not needed for Danswer functionality
# perl-base could only be removed with --allow-remove-essential





COPY . ./

EXPOSE $PORT
# run fast api hypercorn
CMD hypercorn main:app --bind [::]:$PORT
# CMD ["hypercorn", "main:app", "--bind", "[::]:$PORT"]
# CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
