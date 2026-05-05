# ⚡ TaskFlow v2 — Full-Stack Project Management

A production-ready project management app with **REST API**, **PostgreSQL database**, **JWT authentication**, and **role-based access control**.

**Live URL:** `https://your-app.up.railway.app`  
**GitHub:** `https://github.com/YOUR_USERNAME/taskflow`

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway managed) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Deployment | Railway |

---

## 🔌 REST API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Auth | Get current user |

### Projects
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/projects` | Auth | List all projects |
| GET | `/api/projects/:id` | Auth | Project + members |
| POST | `/api/projects` | Admin | Create project |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| POST | `/api/projects/:id/members` | Admin | Add member |
| DELETE | `/api/projects/:id/members/:uid` | Admin | Remove member |

### Tasks
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/tasks` | Auth | List tasks (filtered by role) |
| GET | `/api/tasks/stats` | Auth | Dashboard stats |
| GET | `/api/tasks/:id` | Auth | Single task |
| POST | `/api/tasks` | Auth | Create task |
| PUT | `/api/tasks/:id` | Auth/Owner | Update task |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

### Users
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | Auth | List all users |
| GET | `/api/users/:id/stats` | Auth | User task stats |
| POST | `/api/users/invite` | Admin | Add team member |
| PUT | `/api/users/:id/role` | Admin | Change role |
| DELETE | `/api/users/:id` | Admin | Remove user |

---

## 🔐 Role-Based Access Control

| Feature | Admin | Member |
|---|---|---|
| Create/delete projects | ✅ | ❌ |
| Create tasks | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ |
| Edit/delete any task | ✅ | ❌ |
| Reassign tasks | ✅ | ❌ |
| Invite/remove members | ✅ | ❌ |
| Change user roles | ✅ | ❌ |
| View all tasks | ✅ | ❌ (own only) |

---

## 🗄 Database Schema

```sql
users (id, name, email, password, role, avatar_color, created_at)
projects (id, name, description, color, icon, created_by → users, created_at)
project_members (project_id → projects, user_id → users)  -- many-to-many
tasks (id, title, description, project_id → projects, status, priority,
       assignee_id → users, created_by → users, due_date, created_at, updated_at)
```

---

## 🚀 Local Development

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow

# 2. Install
npm install

# 3. Set env variables
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET

# 4. Run
npm start
# → http://localhost:3000
```

### `.env` file
```
DATABASE_URL=postgresql://user:password@localhost:5432/taskflow
JWT_SECRET=your_super_secret_key_here
NODE_ENV=development
```

---

## 🚂 Deploy to Railway

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main --force
```

### Step 2 — Create Railway Project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → select your repo

### Step 3 — Add PostgreSQL
1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-sets `DATABASE_URL` in your service environment ✅

### Step 4 — Set Environment Variables
In your service → **Variables** tab, add:
```
JWT_SECRET=any_long_random_string_here
NODE_ENV=production
```

### Step 5 — Deploy
Railway auto-deploys on every push. Your app will be live at:
`https://your-app.up.railway.app`

---

## ✅ Requirements Fulfilled

- ✅ **REST APIs** — Full CRUD for projects, tasks, users
- ✅ **PostgreSQL Database** — Managed by Railway
- ✅ **Proper Validations** — express-validator on all inputs
- ✅ **Relationships** — Foreign keys: users → tasks → projects (with CASCADE)
- ✅ **Role-Based Access Control** — JWT middleware + Admin/Member guards
- ✅ **Authentication** — Signup/Login with bcrypt + JWT
- ✅ **Dashboard** — Stats, overdue tasks, project progress
- ✅ **Deployment** — Railway with health check

---

## 📹 Demo Video
_Link to your 2–5 minute walkthrough here_

---

## 📄 License
MIT © 2025
