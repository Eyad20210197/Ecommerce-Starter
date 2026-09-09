import {readDatabaseEnv} from '../src/config/env.js';
import {createDatabase} from '../src/infrastructure/database/connection.js';
const database=createDatabase(readDatabaseEnv());
try{
 await database.query('DELETE FROM sessions WHERE expires_at < now()');
 await database.query('DELETE FROM rate_limits WHERE expires_at < now()');
 console.log('Expired sessions and rate limits removed.');
}finally{await database.close();}

