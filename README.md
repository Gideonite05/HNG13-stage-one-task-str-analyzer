# HNG13-stage-one-task-str-analyzer
RESTfuls API that collect a set of strings from the user and then Analyze the strings, Given out a desire output as a feedback of the code input.

A RESTful API built with Node.js/Express and MySQL to analyze, store, and query string properties. Supports creating, retrieving, filtering (including natural language queries), and deleting strings with robust error handling.
Features
Endpoints: Create, retrieve, filter (standard and natural language), delete strings.
String Properties:
Length
Is palindrome (case-insensitive)
Unique character count
Word count
SHA-256 hash
Character frequency map
Tech Stack: Node.js, Express, MySQL, ESM modules.
Database: MySQL with JSON storage for properties.
Prerequisites
Node.js (v16+)
MySQL (v8+)
npm (v8+)
Setup
Clone the Repository:

 git clone <repository-url>
cd string-analyzer-api


Install Dependencies:

 npm install express mysql2 body-parser uuid


Configure MySQL:


Create a database: CREATE DATABASE string_analyzer;
Update index.js with your MySQL credentials:
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'string_analyzer',
  waitForConnections: true,
  connectionLimit: 10,
});


Start the Server:

 node index.js
 API runs on http://localhost:3000.


Usage Examples
Create a string:
curl -X POST http://localhost:3000/strings -H "Content-Type: application/json" -d '{"value":"hello world"}'


Retrieve a string:
curl http://localhost:3000/strings/hello%20world


Filter strings:
curl http://localhost:3000/strings?is_palindrome=true&min_length=5


Natural language query:
curl http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings


Delete a string:
curl -X DELETE http://localhost:3000/strings/hello%20world


API Documentation
Detailed endpoint information is in API_DOCUMENTATION.md.
License
MIT License

Setup Instructions
Install Node.js and MySQL:
Ensure Node.js (v16+) and MySQL are installed.
Install dependencies: npm install express mysql2 body-parser uuid crypto.
Configure MySQL:
Create a database named string_analyzer.
Update the MySQL connection details (host, user, password) in the code.
Run the Server:
Save the code as index.js.
Run node index.js to start the server on http://localhost:3000.
Sample API Requests:
POST /strings:
 bash
curl -X POST http://localhost:3000/strings -H "Content-Type: application/json" -d '{"value":"hello world"}'


GET /strings/hello%20world:
 bash
curl http://localhost:3000/strings/hello%20world


GET /strings?is_palindrome=true&min_length=5:
 bash
curl http://localhost:3000/strings?is_palindrome=true&min_length=5


GET /strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings:
 bash
curl http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings


DELETE /strings/hello%20world:
 bash
curl -X DELETE http://localhost:3000/strings/hello%20world


Notes
Modules: Uses ESM (import syntax) as requested.
Error Handling: Implements try-catch with .then() for async operations.
Database: MySQL stores strings with their SHA-256 hash as the primary key.
Natural Language Parsing: Basic parsing for the specified query examples; can be extended for more complex queries.
Security: Includes input validation and proper error responses.
Scalability: Connection pooling for MySQL to handle concurrent requests.
