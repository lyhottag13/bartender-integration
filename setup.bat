@echo OFF
:: Clean installs the backend and frontend dependencies.
echo Clean installing node_modules...
CALL npm ci
cd frontend
CALL npm ci
echo Building frontend...
CALL npm run build
cd ..

set /p host=What's the host IP? 
set /p user=What's the user? 
set /p password=What's the password? 
set /p database=What's the database? 

echo import { createPool } from "mysql2/promise";  >  src/db.js
echo const pool = createPool({                     >> src/db.js
echo     host: '%host%',                           >> src/db.js
echo     user: '%user%',                           >> src/db.js
echo     password: '%password%',                   >> src/db.js
echo     database: '%database%'                    >> src/db.js
echo });                                           >> src/db.js
echo export default pool;                          >> src/db.js

set /p hostname=What's the Integration Builder hostname? 

echo export default '%hostname%'; > src\hostname.js

set /p port=What's the desired localhost port? 

echo export default %port%; > src\port.js

echo Creating new PM2 process...
CALL pm2 delete bartender
CALL pm2 start server.js --name bartender
CALL pm2 save