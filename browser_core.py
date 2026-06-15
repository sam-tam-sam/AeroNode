import gi
import threading
import sys
from flask import Flask, request, jsonify

gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

app = Flask(__name__)
webview = None

@app.route('/navigate', methods=['POST'])
def navigate():
    url = request.json.get('url')
    if url:
        if not url.startswith('http'):
            # Simple check if it's a domain or search query
            if '.' in url and ' ' not in url:
                url = 'https://' + url
            else:
                url = 'https://www.google.com/search?q=' + url.replace(' ', '+')
        GLib.idle_add(webview.load_uri, url)
        return jsonify({"status": "loading", "url": url})
    return jsonify({"status": "error", "message": "No URL provided"}), 400

@app.route('/go_back', methods=['POST'])
def go_back():
    GLib.idle_add(webview.go_back)
    return jsonify({"status": "going_back"})

@app.route('/go_forward', methods=['POST'])
def go_forward():
    GLib.idle_add(webview.go_forward)
    return jsonify({"status": "going_forward"})

@app.route('/reload', methods=['POST'])
def reload():
    GLib.idle_add(webview.reload)
    return jsonify({"status": "reloading"})

def start_flask():
    # Run the internal API server on port 5000
    app.run(host='127.0.0.1', port=5000, use_reloader=False)

def main():
    global webview
    
    # Initialize GTK
    window = Gtk.Window()
    # Match standard responsive desktop resolution
    window.set_default_size(1280, 800)
    window.connect("destroy", Gtk.main_quit)
    
    # Setup WebKit2
    webview = WebKit2.WebView()
    
    # Settings
    settings = webview.get_settings()
    settings.set_enable_javascript(True)
    settings.set_enable_html5_local_storage(True)
    settings.set_enable_html5_database(True)
    settings.set_enable_webgl(True)
    settings.set_enable_developer_extras(True)
    
    # Auto-load homepage
    webview.load_uri("https://www.google.com")
    
    window.add(webview)
    
    # Maximize window to fill the Xvfb screen
    window.maximize()
    window.show_all()
    
    # Start Flask API in a background thread
    threading.Thread(target=start_flask, daemon=True).start()
    
    # Start GTK main loop
    Gtk.main()

if __name__ == '__main__':
    main()
