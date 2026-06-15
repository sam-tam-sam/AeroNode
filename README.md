# AeroNode for CasaOS

An ultra-lightweight, proxy-based web browser designed specifically to be hosted locally on CasaOS. 

## Overview
Traditional containerized web browsers rely on heavy VNC/X11 desktop streaming and full Chromium engines, consuming massive amounts of CPU and RAM while providing a clunky experience. 

The **AeroNode** browser solves this by avoiding desktop streaming entirely. Instead, it utilizes a custom, high-performance Node.js Proxy Engine. The backend fetches content, strips CORS, and rewrites URLs, delivering an optimized, native Vanilla JS/Tailwind web interface directly to your host browser. It's incredibly fast, deeply integrated, and uses minimal system resources.

## Key Features
- **Ultra-Lightweight Architecture:** No Chromium, Blink, or VNC streaming required.
- **Built-in Ad-Blocking:** Integrates the EasyList blocklist directly at the proxy layer to eliminate ads before they even reach your device. Site-specific toggles are saved locally via SQLite.
- **Download Management:** Intercepts file downloads and pipes them directly to your external storage directory, complete with a WebSocket-powered real-time progress overlay in the UI.
- **Sleek, Native UI:** A responsive, dark-mode optimized interface built with Vanilla JavaScript and TailwindCSS featuring Iframe-based background tab management.
- **CasaOS Native:** Built from the ground up for CasaOS with built-in app store schema mapping, privileges, and simple environment-variable-based authentication.

## Installation Guide (CasaOS)

AeroNode uses GitHub Container Registry (GHCR) so you can install it seamlessly without any terminal commands or manual builds!

### Step-by-Step Installation

1. Open the `docker-compose.yml` file from this repository and copy its entire contents.
2. Open your CasaOS web interface and click on the **App Center**.
3. Click the **Custom Install** icon located in the top-right corner.
4. Click the **Import** icon (folder icon) at the top right of the new window.
5. Paste the copied YAML content into the text box and click submit. CasaOS will automatically fill out the form for you!
6. **Configure Storage:** Review the Volume mappings. Under `/media_hdd`, ensure the Host path correctly points to the directory where you want your browser downloads saved (e.g., `/mnt/storage/downloads`).
7. **Configure Password:** Set your desired login password via the `APP_PASSWORD` environment variable (default is `casaos`).
8. Click **Install**. CasaOS will automatically pull the compiled image from GHCR and launch the app.

Once installed, simply click on the new "AeroNode" icon on your CasaOS dashboard, log in with your password, and enjoy lightweight browsing!
