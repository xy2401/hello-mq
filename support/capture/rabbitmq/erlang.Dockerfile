ARG BASE_IMAGE
FROM ${BASE_IMAGE}
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG BUILD_JOBS=2
COPY recipe.json install-erlang.sh /tmp/hello-erlang/
RUN BUILD_JOBS="${BUILD_JOBS}" bash /tmp/hello-erlang/install-erlang.sh /tmp/hello-erlang/recipe.json \
    && rm -rf /tmp/hello-erlang
ENV PATH="/opt/erlang/bin:${PATH}"

