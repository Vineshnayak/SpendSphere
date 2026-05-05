# SpendSphere

A collaborative expense tracker built with FastAPI, MongoDB, and Vanilla JavaScript. Supports personal and group-based expense tracking with real-time synchronization via WebSockets.

---

## Features

- **JWT Authentication** — Signup and login with bcrypt-hashed passwords and JWT-based session management.
- **Personal Expense Tracking** — Add, view, and delete transactions with category, date, and "spent by" metadata.
- **Monthly Budget** — Set a monthly budget per user; a progress bar reflects spending in real time with colour-coded thresholds (normal / warning / exceeded).
- **Group Management** — Create expense groups. Each group is assigned a unique 6-character join key. Users join groups by entering this key; no admin approval needed beyond sharing the key.
- **Admin Controls** — The group creator is the admin. Admins can remove members, view the join key, and delete or leave the group (ownership transfers to the next member on leave).
- **Member Actions** — Non-admin members can leave a group at any time.
- **Real-Time Updates** — WebSocket connections push live notifications when a group expense is added, triggering an automatic data refresh for all connected members.
- **Spending Chart** — Doughnut chart (Chart.js) visualises spending by category.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10, FastAPI, Uvicorn |
| Database | MongoDB (via PyMongo) |
| Auth | PyJWT, bcrypt |
| Real-Time | WebSockets (FastAPI native) |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Charts | Chart.js |

---

## Project Structure

```
SpendSphere/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database/
│   │   └── connection.py        # MongoDB client and collection references
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response models
│   ├── routes/
│   │   ├── auth_routes.py       # POST /signup, POST /login
│   │   ├── expense_routes.py    # GET/POST/DELETE /expense(s)
│   │   ├── group_routes.py      # CRUD + join/leave for groups
│   │   ├── user_routes.py       # GET /user, PUT /user/budget
│   │   └── ws_routes.py         # WebSocket endpoint
│   └── services/
│       └── auth_service.py      # JWT creation and password hashing
└── frontend/
    ├── index.html               # Redirects to login
    ├── login.html
    ├── signup.html
    ├── dashboard.html           # Main app UI
    ├── css/
    │   └── style.css
    └── js/
        ├── api.js               # API_URL constant + toast helper
        ├── auth.js              # Login/signup logic
        └── dashboard.js         # Dashboard logic, groups, WebSocket, budget
```

---

## Local Setup

### Prerequisites
- Python 3.10+
- MongoDB running on port `27021`
- A modern web browser

### 1. Start MongoDB

```bash
mongod --port 27021 --dbpath ./backend/database_data
```

### 2. Set Up and Start the Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn pymongo pyjwt bcrypt==4.0.1 websockets
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

### 3. Start the Frontend

```bash
cd frontend
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Register a new user |
| POST | `/login` | Authenticate and receive a JWT |
| GET | `/user` | Get current user profile and budget |
| PUT | `/user/budget` | Update the monthly budget |
| GET | `/expenses` | List all expenses visible to the user |
| POST | `/expense` | Add a new expense |
| DELETE | `/expense/{id}` | Delete an expense |
| GET | `/groups` | List groups the user belongs to |
| POST | `/groups` | Create a group (creator becomes admin) |
| POST | `/groups/join` | Join a group using a 6-char join key |
| DELETE | `/groups/{id}` | Delete a group (admin only) |
| DELETE | `/groups/{id}/members/{user}` | Remove a member (admin only) |
| DELETE | `/groups/{id}/leave` | Leave a group (transfers ownership if admin) |
| WS | `/ws/{token}` | WebSocket connection for live updates |

---

## Notes

- The JWT `SECRET_KEY` in `services/auth_service.py` should be moved to an environment variable before any production deployment.
- MongoDB unique indexes are applied on `username` (users collection) and `name` (groups collection) at startup.
- The `database_data/` directory stores MongoDB data files and should be excluded from version control (already in `.gitignore`).
