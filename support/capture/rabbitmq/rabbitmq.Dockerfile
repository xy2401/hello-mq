ARG ERLANG_IMAGE
FROM ${ERLANG_IMAGE}
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
COPY recipe.json install-rabbitmq.sh /tmp/hello-rabbitmq/
RUN bash /tmp/hello-rabbitmq/install-rabbitmq.sh /tmp/hello-rabbitmq/recipe.json \
    && rm -rf /tmp/hello-rabbitmq
ENV PATH="/opt/rabbitmq/sbin:/opt/erlang/bin:${PATH}"

