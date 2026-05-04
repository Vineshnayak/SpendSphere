# SpendSphere 🚀

A full-stack, real-time collaborative expense tracker.

SpendSphere allows you to securely track your personal expenses, visualize spending trends, and create groups to share and track expenses collaboratively with friends in real-time.

## Features ✨
- **Full-Stack Architecture**: Built with a robust FastAPI (Python) backend and a responsive Vanilla JS frontend.
- **Secure Authentication**: End-to-end user authentication using JWT and bcrypt password hashing.
- **Persistent Storage**: Data is safely stored in a local MongoDB database.
- **Real-Time Collaboration**: Live WebSockets broadcast updates instantly when friends add expenses to a shared group.
- **Group Management**: Create groups, invite friends by username, and toggle expense visibility between 'Personal' and 'Group'.
- **Interactive Insights**: Category pie charts and monthly spend trend line charts powered by Chart.js.
- **Accessible & Responsive**: Modern UI that works flawlessly on desktop and mobile devices.

## Tech Stack 🛠
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Chart.js
- **Backend**: Python, FastAPI, Uvicorn, WebSockets
- **Database**: MongoDB (PyMongo)
- **Security**: PyJWT, passlib, bcrypt

## Getting Started 🚀

### Prerequisites
- Python 3.10+
- MongoDB instance running locally (port 27021 default)

### 1. Database Setup
Ensure MongoDB is running. If you are using the local database data folder:
```bash
cd backend
mongod --port 27021 --dbpath ./database_data
```

### 2. Backend Setup
Navigate to the `backend` folder, set up your virtual environment, and run the server:
```bash
cd backend
source venv/bin/activate
pip install fastapi uvicorn pymongo pyjwt passlib bcrypt==4.0.1 websockets
uvicorn main:app --reload
```
The backend will run on `http://127.0.0.1:8000`.

### 3. Frontend Setup
Navigate to the `frontend` folder and run a simple local web server:
```bash
cd frontend
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your web browser.

## Usage 💡
1. **Sign Up**: Create an account to start tracking your personal expenses.
2. **Create a Group**: Create a group and invite your friends using their exact username.
3. **Add Expenses**: Use the visibility dropdown to choose whether an expense is personal or meant for a group.
4. **Watch it Live**: If a friend posts to a shared group, watch your browser update in real-time!
