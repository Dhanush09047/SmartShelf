from flask import Flask, jsonify, request, render_template, send_from_directory
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__, template_folder="templates", static_folder="static")


def init_db():
    """Initialize Supabase table and seed data if empty"""
    try:
        # Check if table has data
        response = supabase.table("books").select("id", count="exact").execute()
        if response.count == 0:
            # Seed sample data
            seed = [
                {"title": "The Midnight Library", "author": "Matt Haig", "genre": "Fiction", "isbn": "9780525559474", "price": 1245, "stock": 12, "cover": "https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg"},
                {"title": "Atomic Habits", "author": "James Clear", "genre": "Self-Help", "isbn": "9780735211292", "price": 1370, "stock": 25, "cover": "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg"},
                {"title": "Project Hail Mary", "author": "Andy Weir", "genre": "Sci-Fi", "isbn": "9780593135204", "price": 1495, "stock": 8, "cover": "https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg"},
                {"title": "Educated", "author": "Tara Westover", "genre": "Memoir", "isbn": "9780399590504", "price": 1140, "stock": 15, "cover": "https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg"},
                {"title": "Dune", "author": "Frank Herbert", "genre": "Sci-Fi", "isbn": "9780441172719", "price": 930, "stock": 3, "cover": "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg"},
                {"title": "Where the Crawdads Sing", "author": "Delia Owens", "genre": "Fiction", "isbn": "9780735219090", "price": 1245, "stock": 0, "cover": "https://covers.openlibrary.org/b/isbn/9780735219090-L.jpg"},
            ]
            for book in seed:
                supabase.table("books").insert(book).execute()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Note: {e}. Make sure the 'books' table exists in Supabase with columns: id, title, author, genre, isbn, price, stock, cover, created_at")


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/books")
def list_books():
    q = request.args.get("q", "").strip()
    genre = request.args.get("genre", "").strip()
    
    query = supabase.table("books").select("*")
    
    if genre:
        query = query.eq("genre", genre)
    
    response = query.order("id", desc=True).execute()
    rows = response.data
    
    # Filter by search query (text search)
    if q:
        rows = [r for r in rows if q.lower() in r.get("title", "").lower() or 
                q.lower() in r.get("author", "").lower() or 
                q.lower() in r.get("isbn", "").lower()]
    
    return jsonify(rows)


@app.get("/api/stats")
def stats():
    response = supabase.table("books").select("id, stock, price, genre").execute()
    books = response.data
    
    titles = len(books)
    units = sum(b.get("stock", 0) for b in books)
    value = sum(b.get("stock", 0) * b.get("price", 0) for b in books)
    out_of_stock = sum(1 for b in books if b.get("stock", 0) == 0)
    low_stock = sum(1 for b in books if 0 < b.get("stock", 0) < 5)
    
    # Group by genre
    genres_dict = {}
    for book in books:
        g = book.get("genre", "Other") or "Other"
        genres_dict[g] = genres_dict.get(g, 0) + 1
    
    genres = [{"genre": k, "c": v} for k, v in genres_dict.items()]
    
    return jsonify({"titles": titles, "units": units, "value": value, "out_of_stock": out_of_stock, "low_stock": low_stock, "genres": genres})


@app.post("/api/books")
def create_book():
    d = request.get_json(force=True)
    book_data = {
        "title": d.get("title"),
        "author": d.get("author"),
        "genre": d.get("genre"),
        "isbn": d.get("isbn"),
        "price": float(d.get("price") or 0),
        "stock": int(d.get("stock") or 0),
        "cover": d.get("cover")
    }
    response = supabase.table("books").insert(book_data).execute()
    row = response.data[0] if response.data else {}
    return jsonify(row), 201


@app.put("/api/books/<int:bid>")
def update_book(bid):
    d = request.get_json(force=True)
    book_data = {
        "title": d.get("title"),
        "author": d.get("author"),
        "genre": d.get("genre"),
        "isbn": d.get("isbn"),
        "price": float(d.get("price") or 0),
        "stock": int(d.get("stock") or 0),
        "cover": d.get("cover")
    }
    response = supabase.table("books").update(book_data).eq("id", bid).execute()
    if not response.data:
        return jsonify({"error": "not found"}), 404
    return jsonify(response.data[0])


@app.patch("/api/books/<int:bid>/stock")
def adjust_stock(bid):
    delta = int(request.get_json(force=True).get("delta", 0))
    # Get current stock
    get_response = supabase.table("books").select("stock").eq("id", bid).execute()
    if not get_response.data:
        return jsonify({"error": "not found"}), 404
    
    current_stock = get_response.data[0].get("stock", 0)
    new_stock = max(0, current_stock + delta)
    
    response = supabase.table("books").update({"stock": new_stock}).eq("id", bid).execute()
    return jsonify(response.data[0])


@app.delete("/api/books/<int:bid>")
def delete_book(bid):
    supabase.table("books").delete().eq("id", bid).execute()
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host=host, debug=debug, port=port, use_reloader=False)
