import { createPool } from "mysql2/promise";  
const pool = createPool({                     
    host: '',                           
    user: '',                           
    password: '',                   
    database: ''                    
});                                           
export default pool;                          
