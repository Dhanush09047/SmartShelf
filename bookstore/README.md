# Inkwell · Bookstore Inventory

A polished bookstore inventory system with a Flask backend and a vanilla HTML/CSS/JS frontend.

## Features
- Dashboard with live stats (titles, units, inventory value, low/out alerts)
- Full CRUD for books (title, author, genre, ISBN, price, stock, cover image)
- Search by title/author/ISBN, filter by genre
- One-click stock increment / decrement
- SQLite storage (auto-seeded with sample data on first run)
- Responsive dark UI with gradient accents

## Run

```bash
pip install flask
python app.py
```

Open http://localhost:5000

## Stack
- Backend: Python · Flask · SQLite
- Frontend: HTML · CSS · vanilla JS (no build step)
