# AcademiaX Digital Learning

## Project Overview
AcademiaX is a higher education course enrollment and tuition processing platform built using a Java Spring Boot microservices architecture and a React frontend. The system includes an API Gateway, Eureka service discovery, JWT authentication, course management, enrollment workflow, payment processing, and admin/instructor/student dashboards.

## Architecture
- React frontend communicates only with API Gateway on port 8080.
- Spring Cloud Gateway handles routing and JWT auth.
- Eureka Server runs on port 8761 and registers all services.
- Auth Service handles user registration/login/JWT issuance.
- Course Service manages course catalog and seat inventory.
- Enrollment Service orchestrates purchase and enrollment with Course and Payment calls.
- Payment Service simulates payment processing.

## Technologies
- Java 17
- Spring Boot 3.3.x
- Spring Cloud 2023.0.x
- Spring Data JPA
- Spring Security
- JWT (jjwt)
- MySQL
- OpenFeign
- Resilience4j
- Maven multi-module
- React 18
- Vite
- Tailwind CSS
- Axios
- Docker Compose

## Folder Structure
```text
AcademiaX/
├── frontend/
├── backend/
│   ├── pom.xml
│   ├── eureka-server/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── course-service/
│   ├── enrollment-service/
│   ├── payment-service/
├── docker-compose.yml
├── postman/
├── README.md
```

## Prerequisites
- Java 17+
- Maven 3.9+
- Node.js 18+
- npm 9+
- MySQL 8+
- Docker Desktop (optional)

## VS Code / PowerShell Commands
Open the project folder:
```powershell
cd C:\varshini\AcademiaX
```

Start backend build:
```powershell
cd C:\varshini\AcademiaX\backend
mvn clean install
```

Start frontend:
```powershell
cd C:\varshini\AcademiaX\frontend
npm install
npm run dev
```

Run Docker:
```powershell
cd C:\varshini\AcademiaX
docker-compose up --build
```

## Local Development
### MySQL
Create a local MySQL database instance and update environment variables as needed.

### Backend
From project root:
```powershell
cd C:\varshini\AcademiaX\backend
mvn clean install
```
Then start the services in the order below.

### Frontend
```powershell
cd C:\varshini\AcademiaX\frontend
npm install
npm run dev
```

## Start Order
1. MySQL
2. Eureka Server
3. Auth Service
4. Course Service
5. Payment Service
6. Enrollment Service
7. API Gateway
8. Frontend

Eureka must start before services because all services register with it during startup.

## URLs
- Frontend: http://localhost:5173
- API Gateway: http://localhost:8080
- Eureka Dashboard: http://localhost:8761
- Swagger UI: available per service under /swagger-ui/index.html

## Sample Credentials
- Instructor: instructor@academiax.com / Instructor@123
- Student: student@academiax.com / Student@123
- Admin: admin@academiax.com / Admin@123

These are development/demo credentials.

## Microservice Communication
- Frontend -> API Gateway -> service
- Enrollment Service communicates to Course Service and Payment Service using OpenFeign.
- Eureka handles client-side service discovery and load balancing.

## Testing
Run backend tests with:
```powershell
cd C:\varshini\AcademiaX\backend
mvn test
```

## Docker
```powershell
cd C:\varshini\AcademiaX
docker-compose up --build
```

The Compose stack exposes the frontend at `http://localhost:5173` and routes browser API calls through the gateway at `http://localhost:8080`. The backend service images build from the parent Maven project so Docker and local Maven builds use the same module structure.

To stop the stack:
```powershell
docker-compose down
```

To remove the local MySQL volume as well:
```powershell
docker-compose down -v
```

## Troubleshooting
- Ensure MySQL is running and reachable.
- Check Eureka dashboard to confirm service registration.
- Verify environment variables are loaded.
- Review service logs if a dependency fails.

## Demo Flow
1. Register/login as student.
2. Browse courses.
3. Enroll in a course.
4. Create and confirm payment.
5. Check confirmed enrollment and seat availability.

## Important Notes
This project is designed for a college demo and uses mock payment behavior rather than a real banking integration.
