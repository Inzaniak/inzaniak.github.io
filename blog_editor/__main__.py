from .app import create_app

app = create_app()
app.run(host="127.0.0.1", port=5050, debug=False)
