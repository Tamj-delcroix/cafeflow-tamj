# CafeFlow

A full-stack cafe ordering web application built to demonstrate an online menu, shopping cart, order management, and an admin dashboard.

## Overview

CafeFlow is a cafe ordering application with a dark luxury visual theme, combining a black-and-gold interface with a backend powered by Node.js and MySQL.

## Features

- Interactive cafe menu
- Shopping cart
- Order management
- Admin dashboard
- MySQL database integration
- Session-based authentication
- Responsive web interface

## Tech Stack

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- MySQL
- npm

## Project Structure

```text
cafeflow/
├── db/
│   └── schema.sql
├── public/
│   ├── admin.html
│   ├── index.html
│   ├── css/
│   │   ├── admin.css
│   │   └── style.css
│   └── js/
│       ├── admin.js
│       └── app.js
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## Requirements

- Node.js and npm
- MySQL server, such as MySQL from XAMPP

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Tamj-delcroix/cafeflow-tamj.git
   ```

2. Enter the project directory:

   ```bash
   cd cafeflow-tamj
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root using `.env.example` as a reference.

5. Configure the database connection and session secret in `.env`.

6. Start MySQL and create the database using `db/schema.sql`.

7. Start the application using the appropriate command defined in `package.json`.

8. Open the local address shown in the terminal.

## Environment Configuration

Keep database credentials and session secrets in `.env`. Never commit real credentials or production secrets to GitHub.

## Security Notes

- Use a strong, unique session secret.
- Use a strong administrator password.
- Review authentication, session handling, and input validation before deploying publicly.

## Author

**Tamj-delcroix**

GitHub: https://github.com/Tamj-delcroix

## License

This project is intended for portfolio and learning purposes.
