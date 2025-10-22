import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();
console.log(process.env.DATABASE_URL)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  // AUTO-CREATE TABLES FROM MODEL
  synchronize: true
});

export default sequelize;