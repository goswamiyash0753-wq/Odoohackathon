# 🚀 Odoo Hackathon - Full Stack Application

[![Node.js](https://img.shields.io/badge/Node.js-v14+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2.6-blue?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0.12-purple?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.2.1-lightgrey?style=flat-square&logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)](LICENSE)

A modern, production-ready full-stack web application built for the Odoo Hackathon, combining a React frontend with an Express.js backend and SQLite database. Features secure authentication, responsive design, and comprehensive API integration.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Features](#features)
- [Database](#database)
- [Environment Configuration](#environment-configuration)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)
- [Performance Tips](#performance-tips)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Team & Contributors](#team--contributors)
- [License](#license)

## ⚡ Quick Start

Get up and running in 5 minutes:

```bash
# Clone the repository
git clone https://github.com/goswamiyash0753-wq/Odoohackathon.git
cd Odoohackathon/HACKATHON

# Install dependencies
npm install
cd myapp && npm install && cd ..

# Setup environment
cp .env.example .env

# Start development
npm run dev
```

Your app will be running at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

## 🎯 Overview

This application is a comprehensive full-stack solution designed for modern procurement management. It combines:

- **Responsive Frontend**: Built with React 19 and Vite for lightning-fast development and production builds
- **Robust Backend**: Express.js server with RESTful API endpoints and comprehensive error handling
- **Secure Authentication**: JWT-based authentication with bcryptjs password hashing
- **Reliable Database**: SQLite for persistent data storage with transaction support
- **Production Ready**: Optimized for deployment with proper configuration management and security best practices

Perfect for teams looking for a modern, scalable foundation for their web applications.

## 🛠 Tech Stack

### Frontend
- **React** 19.2.6 - A JavaScript library for building user interfaces
- **Vite** 8.0.12 - Next-generation frontend tooling
- **React DOM** 19.2.6 - React package for working with the DOM
- **ESLint** - JavaScript linting

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** 5.2.1 - Fast, unopinionated web framework
- **Better SQLite3** 12.10.0 - Synchronous SQLite3 wrapper
- **Bcryptjs** 3.0.3 - Password hashing library
- **JSON Web Tokens (JWT)** 9.0.3 - Authentication tokens
- **CORS** 2.8.6 - Cross-Origin Resource Sharing middleware
- **Body Parser** 2.2.2 - Request body parsing middleware
- **UUID** 14.0.0 - Unique identifier generation
- **dotenv** 17.4.2 - Environment variable management

### Database
- **SQLite** - Lightweight, file-based database

## 📁 Project Structure

```
HACKATHON/
├── myapp/                          # React Frontend Application
│   ├── src/
│   │   ├── components/             # Reusable React components
│   │   ├── pages/                  # Page-level components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── utils/                  # Utility functions
│   │   ├── App.jsx                 # Root component
│   │   └── main.jsx                # Entry point
│   ├── public/                     # Static assets (images, fonts, etc.)
│   ├── index.html                  # HTML entry point
│   ├── vite.config.js              # Vite configuration
│   ├── eslint.config.js            # ESLint configuration
│   ├── package.json                # Frontend dependencies
│   └── README.md                   # Frontend documentation
│
├── server/                         # Express Backend Application
│   ├── index.js                    # Server entry point & middleware setup
│   ├── routes/                     # API route handlers
│   │   ├── auth.js                 # Authentication routes
│   │   ├── procurement.js          # Procurement routes
│   │   └── users.js                # User management routes
│   ├── middleware/                 # Custom middleware
│   ├── models/                     # Database models
│   └── utils/                      # Helper functions
│
├── .env                            # Environment variables (local, not versioned)
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── .vscode/                        # VS Code settings and extensions
├── procurement.db                  # SQLite database file
├── procurement.db-shm              # SQLite shared memory file
├── procurement.db-wal              # SQLite write-ahead log
├── package.json                    # Root dependencies & scripts
├── package-lock.json               # Dependency lock file
└── README.md                       # This file
```

### Key Directories Explained

| Directory | Purpose |
|-----------|---------|
| `myapp/src` | React components, pages, hooks, and utilities |
| `myapp/public` | Static assets served to the browser |
| `server/routes` | API endpoint definitions and handlers |
| `server/middleware` | Authentication, logging, error handling middleware |
| `server/models` | Database schema and query functions |

## 📋 Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (v14.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v6.0.0 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)

To verify installation:
```bash
node --version
npm --version
git --version
```

## 🚀 Installation

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/goswamiyash0753-wq/Odoohackathon.git
   cd Odoohackathon/HACKATHON
   ```

2. **Verify Prerequisites**
   ```bash
   node --version  # Should be v14.0.0 or higher
   npm --version   # Should be v6.0.0 or higher
   ```

3. **Install root dependencies**
   ```bash
   npm install
   ```
   This installs backend dependencies (Express, SQLite, JWT, etc.)

4. **Install frontend dependencies**
   ```bash
   cd myapp
   npm install
   cd ..
   ```
   This installs React, Vite, and frontend tooling

5. **Setup environment variables**
   ```bash
   cp .env.example .env
   nano .env  # or use your preferred editor
   ```
   Configure the following:
   - `PORT` - Server port (default: 3000)
   - `JWT_SECRET` - Secret key for JWT tokens
   - `DATABASE_PATH` - Path to SQLite database
   - `NODE_ENV` - Set to 'development' or 'production'

6. **Verify Installation** (Optional)
   ```bash
   npm run build
   ```
   This tests that the frontend build process works correctly

## ⚙️ Running the Application

### Development Mode (Frontend & Backend Concurrently)
```bash
npm run dev
```
This command runs both the Express backend and the React frontend development server simultaneously using `concurrently`.

- **Backend**: Typically runs on `http://localhost:3000` (or configured port)
- **Frontend**: Typically runs on `http://localhost:5173` (Vite default)

### Backend Only
```bash
npm run dev:backend
```
Starts the Express.js server for API development.

### Frontend Only
```bash
cd myapp
npm run dev
```
Starts the Vite development server with React.

### Build for Production
```bash
npm run build
```
Creates an optimized production build of the React frontend in the `myapp/dist` directory.

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing before deployment.

## 📜 Available Scripts

### Root Directory (`package.json`)

| Script | Description |
|--------|-------------|
| `npm start` | Start the backend server in production mode |
| `npm run dev` | Start both backend and frontend in development mode (concurrently) |
| `npm run dev:backend` | Start backend server only |
| `npm run dev:frontend` | Start frontend development server only |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the production build locally |

### Frontend Directory (`myapp/package.json`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint to check code quality |
| `npm run preview` | Preview production build |

## 🔌 API Endpoints

### Authentication Routes
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and receive JWT token
- `POST /api/auth/logout` - Logout user

### User Routes
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get specific user details
- `PUT /api/users/:id` - Update user information
- `DELETE /api/users/:id` - Delete user account

### Procurement Routes
- `GET /api/procurement` - List all procurement items
- `GET /api/procurement/:id` - Get procurement item details
- `POST /api/procurement` - Create new procurement request
- `PUT /api/procurement/:id` - Update procurement request
- `DELETE /api/procurement/:id` - Delete procurement request

### Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful",
  "timestamp": "2026-06-06T12:00:00Z"
}
```

## ✨ Features

- **User Authentication**: Secure login/registration with bcryptjs password hashing and JWT tokens
- **Full-Stack Architecture**: Separation of concerns with dedicated frontend and backend
- **API Integration**: RESTful API endpoints for data management
- **Database Management**: SQLite for persistent data storage
- **CORS Support**: Cross-origin requests handled safely
- **Environment Configuration**: Environment-based configuration with `.env` files
- **ESLint Integration**: Code quality checks for JavaScript
- **Hot Module Replacement (HMR)**: Fast development experience with Vite
- **Modern React**: Latest React 19 with modern JavaScript features

## �️ Development Guidelines

### Code Style & Standards

**Frontend (React)**
- Follow ESLint rules configured in `eslint.config.js`
- Use functional components with React hooks
- Keep components small and single-responsibility
- Use meaningful component and variable names
- Write JSDoc comments for complex logic

**Backend (Express)**
- Follow RESTful API conventions
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch
- Add request validation middleware
- Document API endpoints with comments

### Running with Debugging

**Frontend**
```bash
# Debug in browser with React DevTools
cd myapp
npm run dev
# Open http://localhost:5173 and use React DevTools extension
```

**Backend**
```bash
# Debug with Node inspector
node --inspect server/index.js
# Open chrome://inspect in Chrome
```

### Testing

Currently, the project is configured for development. To add testing:

**Frontend Testing**
```bash
cd myapp
npm install --save-dev vitest @testing-library/react
```

**Backend Testing**
```bash
npm install --save-dev jest supertest
```

### Code Linting

**Check for issues**
```bash
cd myapp
npm run lint
```

**Fix issues automatically**
```bash
npm run lint -- --fix
```

## �🗄️ Database

### SQLite Database

The application uses **SQLite** for data persistence. The database file is typically located at `procurement.db`.

- **File-based**: No separate database server required
- **Lightweight**: Ideal for small to medium applications
- **ACID Compliant**: Reliable transactions and data integrity

### Database Files

- `procurement.db` - Main database file
- `procurement.db-shm` - Shared memory file (SQLite internal)
- `procurement.db-wal` - Write-ahead log file (SQLite internal)

## 🔐 Environment Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_strong_jwt_secret_key_here_min_32_chars
JWT_EXPIRE=7d

# Database Configuration
DATABASE_PATH=./procurement.db

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

### Environment Variables Explanation

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | 3000 |
| `NODE_ENV` | Environment mode (development/production) | development |
| `JWT_SECRET` | Secret key for signing JWT tokens | - |
| `JWT_EXPIRE` | JWT token expiration time | 7d |
| `DATABASE_PATH` | Path to SQLite database | ./procurement.db |
| `CORS_ORIGIN` | Allowed origins for CORS | http://localhost:5173 |
| `FRONTEND_URL` | Frontend application URL | http://localhost:5173 |
| `LOG_LEVEL` | Logging verbosity level | info |

### Security Best Practices

✅ **Do's**
- Store sensitive data in `.env` files (never commit to version control)
- Use strong JWT secrets (minimum 32 characters)
- Rotate JWT secrets periodically in production
- Hash passwords with bcryptjs (minimum 10 salt rounds)
- Validate all user inputs on the backend
- Use HTTPS in production
- Implement rate limiting on API endpoints
- Set proper CORS policies
- Use environment-specific configurations

❌ **Don'ts**
- Don't commit `.env` files to Git
- Don't expose sensitive data in error messages
- Don't use weak passwords or secrets
- Don't skip input validation
- Don't disable CORS in production
- Don't log sensitive information
- Don't hard-code database credentials

## 📦 Dependencies Overview

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.2.1 | Web framework |
| better-sqlite3 | ^12.10.0 | Database driver |
| bcryptjs | ^3.0.3 | Password hashing |
| jsonwebtoken | ^9.0.3 | Authentication |
| cors | ^2.8.6 | CORS middleware |
| dotenv | ^17.4.2 | Environment management |
| react | ^19.2.6 | UI library |
| vite | ^8.0.12 | Build tool |

## 🌐 Deployment

### Deploying to Production

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Set environment variables** on your hosting platform

3. **Start the production server**
   ```bash
   npm start
   ```

### Recommended Hosting Platforms

- **Heroku** - Easy deployment with Git
- **Vercel** - Optimized for frontend deployment
- **AWS** - Scalable cloud infrastructure
- **DigitalOcean** - Simple VPS hosting
- **Railway** - Modern platform for full-stack apps

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

- Follow ESLint rules for JavaScript
- Write clear, descriptive commit messages
- Test your changes before submitting a PR
- Keep code clean and well-commented

## � Team & Contributors

### Project Team

| Name | Role | GitHub | Contact |
|------|------|--------|---------|
| Yashwant Goswami | Lead Developer & Project Lead | [@goswamiyash0753-wq](https://github.com/goswamiyash0753-wq) | [GitHub Profile](https://github.com/goswamiyash0753-wq) |
| Yash Goswami | Developer | [@goswamiyash0753-wq](https://github.com/goswamiyash0753-wq) | [GitHub Profile](https://github.com/goswamiyash0753-wq) |

### Contributions

We welcome contributions from the community! To contribute:

1. **Report Issues**: Found a bug? [Open an issue](https://github.com/goswamiyash0753-wq/Odoohackathon/issues)
2. **Submit PRs**: Have improvements? [Submit a pull request](https://github.com/goswamiyash0753-wq/Odoohackathon/pulls)
3. **Suggest Features**: Ideas for new features? Let us know in discussions

### Recognition

Special thanks to:
- The Odoo community for their platform and support
- All contributors who have helped improve this project

## �📝 License

This project is licensed under the ISC License. See the `package.json` file for more details.

## 📧 Support & Questions

For support, questions, or issues, please open an issue on the GitHub repository or contact the project maintainer.

---

**Built with ❤️ for the Odoo Hackathon**
