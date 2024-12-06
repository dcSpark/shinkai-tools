
FROM denoland/deno:debian-2.1.1

SHELL ["/bin/bash", "-c"]

# Add chromium
RUN apt-get update && apt-get install -y chromium
ENV CHROME_PATH=/usr/bin/chromium

# Add python 3
RUN apt-get install -y python3 python3-pip python3-venv

WORKDIR /app
RUN python3 -m venv cache/python-venv && source cache/python-venv/bin/activate && pip install pipreqs

ENTRYPOINT ["/tini", "--"]
