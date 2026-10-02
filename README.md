# Football Tournament Management System
A full-stack football tournament management application built with Django REST Framework, Django Channels, Next.js and Redis.


The system allows administrators to manage tournaments, teams, rounds and matches while spectators can follow live scores, match events and tournament standings in real time.


## 1. Technology Stack
### Backend
- Python

- Django 5.2

- Django REST Framework

- Django Channels

- Redis (Memurai can be used on Windows)

- SQLite for local development

- PostgreSQL as the intended production database


### Frontend
- Next.js

- React

- TypeScript

- Tailwind CSS

- Native WebSocket API


### Architecture
Next.js Frontend

      |

      | REST API / Session Authentication

      v

Django REST Framework

      |

      | Business Logic

      v

Tournament Services

      |

      +------ Database

      |

      +------ Django Channels

                    |

                    v

                  Redis

                    |

                    v

          WebSocket Subscribers

```


All match-related operations use shared backend service functions. This allows both administrator actions and automated simulations to follow the same business rules and broadcast realtime updates.


---


## 2. Features


### Administrator Features


- Administrator login and logout.

- Session-based authentication.

- Protected administrative routes.

- Create, update and delete tournaments.

- Manage football teams.

- Register teams for tournaments.

- Create tournament rounds.

- Schedule matches.

- Start and finish matches.

- Record goals and player names.

- Record yellow cards, red cards and penalty kicks.

- Award bonus points.

- View match activity and scores.


### Public Features


- Browse tournaments.

- View tournament details.

- View scheduled, live and completed matches.

- Follow live match scores.

- View chronological match-event timelines.

- View tournament standings.

- Access a global live scoreboard.


### Realtime Functionality


Django Channels and Redis provide WebSocket communication.


When a match starts, finishes, or receives a new event, the backend broadcasts updates to connected spectators.


The frontend updates without requiring manual page refreshes.


---


## 3. Project Structure


football-tournament/

|

|-- backend/

|   |-- config/

|   |-- tournament/

|   |   |-- management/

|   |   |   |-- commands/

|   |   |       |-- seed_demo.py

|   |   |       |-- simulate_match.py

|   |   |       |-- simulate_event.py

|   |   |

|   |   |-- models.py

|   |   |-- serializers.py

|   |   |-- services.py

|   |   |-- consumers.py

|   |   |-- routing.py

|   |   |-- views.py

|   |   |-- urls.py

|   |   |-- tests.py

|   |

|   |-- manage.py

|   |-- requirements.txt

|

|-- frontend/

|   |-- src/

|       |-- app/

|       |-- components/

|       |-- lib/

|

|-- README.md

|-- .gitignore

```


**---**


## 4. Backend Installation
### Requirements
Install:


- Python

- Node.js and npm

- Redis or Memurai

- Git


### Clone the repository
```bash

git clone https://github.com/adnanakhtar95/football-tournament.git

cd football-tournament

```


### Create a Python virtual environment
```bash

cd backend

python -m venv venv

```


Activate it on Windows PowerShell:


```powershell

.\venv\Scripts\Activate.ps1

```


On Linux/macOS:


```bash

source venv/bin/activate

```


### Install backend dependencies
```bash

pip install -r requirements.txt

```


### Environment configuration
Create `backend/.env` with your own PostgreSQL credentials:

```dotenv
DB_NAME=football_tournament
DB_USER=football_user
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_HOST=localhost
DB_PORT=5432
```

Do not commit `.env` files or database credentials to Git. The backend loads these variables using `python-dotenv`.


### Database setup — PostgreSQL 18

Install PostgreSQL from https://www.postgresql.org/download/ and ensure the server is running on port `5432`.

Using `psql` as the PostgreSQL administrator, create a dedicated application role and database:

```sql
CREATE USER football_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE football_tournament OWNER football_user;
```

Use the same application password in `backend/.env`. The Django database engine is `django.db.backends.postgresql`, using the `psycopg` driver installed from `requirements.txt`.

Apply migrations to initialize a fresh database:

```bash
python manage.py migrate
python manage.py check
```

Create an administrator:

```bash
python manage.py createsuperuser
```

**Automated tests:** Django creates a separate temporary PostgreSQL database. For local test runs, the application role needs permission to create databases; as the PostgreSQL administrator, run:

```sql
ALTER ROLE football_user CREATEDB;
```

This grants database-creation permission, not PostgreSQL superuser access. It can be revoked after testing with `ALTER ROLE football_user NOCREATEDB;`.

### Start Redis
Ensure Redis is running on:


```text

127.0.0.1:6379

```


On Windows, Memurai can provide Redis-compatible functionality.


Verify the connection using:


```bash

redis-cli ping

```


Expected response:


```text

PONG

```


### Start the Django backend
```bash

python manage.py runserver

```


Backend URL:


http://localhost:8000


Django administration:


http://localhost:8000/admin/


**---**


## 5. Frontend Installation
Open another terminal from the project root.


```bash

cd frontend

npm install

```


Create `frontend/.env.local`:


```env

NEXT_PUBLIC_API_URL=http://localhost:8000/api

```


Start the frontend:


```bash

npm run dev

```


Frontend URL:


http://localhost:3000


Custom administrator dashboard:


http://localhost:3000/admin


Use the Django superuser credentials to sign in.


****Important:**** Use `localhost` consistently for both applications to avoid development cookie and session issues.


**---**


## 6. API Endpoints
### Public Endpoints
| Method | Endpoint | Description |

|---|---|---|

| GET | `/api/events/` | List tournaments |

| GET | `/api/events/{id}/` | Tournament details |

| GET | `/api/teams/` | List teams |

| GET | `/api/matches/` | List matches |

| GET | `/api/matches/{id}/` | Match details |

| GET | `/api/matches/{id}/events/` | Match timeline |

| GET | `/api/events/{id}/standings/` | Tournament standings |

| GET | `/api/live/` | Live matches |


### Authentication Endpoints
| Method | Endpoint | Description |

|---|---|---|

| GET | `/api/auth/csrf/` | Initialize CSRF cookie |

| GET | `/api/auth/me/` | Current session information |

| POST | `/api/auth/login/` | Administrator login |

| POST | `/api/auth/logout/` | Logout |


### Administrator Endpoints
The administrator API provides management routes for:


/api/admin/events/

/api/admin/teams/

/api/admin/event-teams/

/api/admin/rounds/

/api/admin/matches/


Supported operations include creating, retrieving, updating and deleting the relevant resources, subject to backend validation and permissions.


### Match Actions
POST /api/matches/{id}/start/

POST /api/matches/{id}/finish/

POST /api/matches/{id}/goal/

POST /api/matches/{id}/event/


Administrative operations require an authenticated staff account.


**---**


## 7. WebSocket Endpoints
### Individual Match
ws://localhost:8000/ws/matches/{match_id}/


Broadcasts match-specific updates, including goals, match events and status changes.


### Global Live Scoreboard
ws://localhost:8000/ws/live/


Broadcasts updates affecting the global live scoreboard.


### Implementation
The backend uses Django Channels groups:


match_{match_id}

live_scoreboard


Match updates are broadcast through shared service functions using transaction commit callbacks, ensuring that updates are sent after successful database transactions.


**---**


## 8. Match Simulation
The project includes automated simulation commands.


Both manual administrator actions and simulation commands reuse the same backend service functions.


### Simulate an Individual Match
python manage.py simulate_match 7 --speed 1


Replace `7` with an existing scheduled match ID.


The `--speed` argument specifies the number of real seconds per simulated football minute.


Examples:


| Speed | Approximate Match Duration |

|---|---|

| `--speed 5` | 7 minutes 30 seconds |

| `--speed 2` | 3 minutes |

| `--speed 1` | 90 seconds |

| `--speed 0.5` | 45 seconds |

| `--speed 0.2` | 18 seconds |


During simulation, the command may generate:


- Goals.

- Yellow cards.

- Red cards.

- Penalty kicks.

- Bonus-point rewards.


Events are generated probabilistically, so individual results vary.


### Simulate an Entire Tournament
```bash

python manage.py simulate_event 3 --speed 1

```


Replace `3` with an existing event ID.


The command finds all scheduled matches belonging to that event and simulates them sequentially.


****Requirements:****


- The tournament must be active.

- At least one scheduled match must exist.

- Matches must have valid registered teams.


Previously completed matches are not simulated again.


**---**


## 9. Demo Data
A Django management command is available to generate sample tournament data:


```bash

python manage.py seed_demo

```


It creates:


- Islamabad Football Cup.

- Four sample teams.

- Team registrations.

- Three tournament rounds.

- Two initial scheduled matches.


The command uses `get_or_create()` to avoid duplicating its existing records.


It does not reset previously completed matches or automatically reactivate an existing tournament.


**---**


## 10. Tournament Business Rules
The backend enforces the following rules:


1\. A team cannot play against itself.

2\. Both participating teams must be registered for the tournament.

3\. A team cannot be scheduled more than once in the same round.

4\. A match can start only when scheduled and its tournament is active.

5\. Only live matches can be finished.

6\. Goals and match events can only be recorded during live matches.

7\. Goals update the appropriate team's score.

8\. Match-event minutes must fall between 0 and 120.

9\. Only supported match-event types are accepted.

10\. Standings are calculated using completed matches.


### Standings Calculation
| Result | Points |

|---|---:|

| Win | 3 |

| Draw | 1 |

| Loss | 0 |


Additional reward points are included in the total.


Standings also track:


- Matches played.

- Wins, draws and losses.

- Goals scored.

- Goals conceded.

- Goal difference.

- Bonus points.


Ranking considers total points, goal difference and goals scored.


**---**


## 11. Automated Testing
The project includes Django automated tests covering:


- Model constraints.

- Tournament registration.

- Match scheduling validation.

- Match status transitions.

- Goal scoring.

- Match events.

- Reward points.

- Tournament standings.

- WebSocket broadcast callback scheduling.


Run the test suite:


cd backend

python manage.py test tournament --verbosity 2


Latest verified local result:


Ran 33 tests in 0.989s


OK

```


Verified locally: all 33 tests passed against PostgreSQL 18. Django creates and destroys a separate temporary test database, leaving application data unaffected.


---


## 12. Development Notes


- PostgreSQL 18 is the active local database; Django connects through `psycopg` and `.env` configuration.

- Existing SQLite data was migrated locally to PostgreSQL. SQLite is not required for a fresh installation.

- Redis/Memurai is required for the configured realtime channel layer.

- Backend business logic is centralized in `tournament/services.py`.

- Simulation commands reuse existing service functions rather than implementing separate scoring logic.

- Match scorer names are stored as text in match events; a separate Player management module is not currently included.


---


## 13. Future Improvements


Potential extensions include:


- Dedicated player profiles and squad management.

- Automatic tournament bracket generation.

- Additional Channels integration tests.

- Production deployment configuration.

- Enhanced tournament statistics.

- Docker-based deployment.


---


## 14. Repository


GitHub:


https://github.com/adnanakhtar95/football-tournament
