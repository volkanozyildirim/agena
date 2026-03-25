FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    git openssh-client curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Corporate SSL certificate (FLO McAfee Web Gateway)
COPY docker/FLOMcAfeeWG.crt /usr/local/share/ca-certificates/FLOMcAfeeWG.crt
RUN update-ca-certificates
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Python deps (requirements.txt değişmezse cache'den gelir)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 8010

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8010"]
