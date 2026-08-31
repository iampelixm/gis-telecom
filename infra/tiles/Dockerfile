FROM ubuntu:24.04 AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tar \
    && rm -rf /var/lib/apt/lists/*

COPY martin.tar.gz /tmp/martin.tar.gz
COPY config.yaml /etc/martin/config.yaml

RUN tar -xzf /tmp/martin.tar.gz -C /usr/local/bin \
    && rm /tmp/martin.tar.gz

ENV MARTIN_CONFIG=/etc/martin/config.yaml
ENV MARTIN_CONNECTION_POOL_SIZE=8

EXPOSE 3200

ENTRYPOINT ["martin", "-c", "/etc/martin/config.yaml", "--listen-addresses", "0.0.0.0:3200", "--cache-expiry", "5s"]
