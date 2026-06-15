FROM debian:bookworm-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, Python, GTK, WebKit, and VNC tools
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-flask \
    python3-gi \
    python3-gi-cairo \
    gir1.2-gtk-3.0 \
    gir1.2-webkit2-4.1 \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy application files
COPY package*.json ./
RUN npm install

COPY . .

# Expose UI port (5800) and noVNC WebSocket port (6080)
EXPOSE 5800 6080

# Ensure Python can find GTK
ENV DISPLAY=:99

CMD ["npm", "start"]
