
FROM denoland/deno:debian-2.1.1
RUN apt-get update && apt-get install -y curl

# Install Google Chrome
RUN curl -LO  https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get install -y ./google-chrome-stable_current_amd64.deb
RUN rm google-chrome-stable_current_amd64.deb
RUN apt-get install -y chromium

ENV CHROME_PATH=/usr/bin/google-chrome
