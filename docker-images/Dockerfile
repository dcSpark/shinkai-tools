
FROM denoland/deno:debian-2.1.1

SHELL ["/bin/bash", "-c"]

# Add chromium
RUN apt-get update && apt-get install -y chromium
ENV CHROME_PATH=/usr/bin/chromium

RUN apt-get install -y curl

WORKDIR /app
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

RUN source $HOME/.local/bin/env && uv venv --seed cache/python-venv --python 3.13 && source cache/python-venv/bin/activate && uv pip install pipreqs

ENTRYPOINT ["/tini", "--"]
