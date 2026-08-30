FROM ubuntu:24.04 AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY martin /usr/local/bin/martin
COPY config.yaml /etc/martin/config.yaml

ENV MARTIN_CONFIG=/etc/martin/config.yaml
ENV MARTIN_CONNECTION_POOL_SIZE=8

EXPOSE 3200

ENTRYPOINT ["martin", "-c", "/etc/martin/config.yaml", "--listen-addresses", "0.0.0.0:3200"]
