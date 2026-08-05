import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.env === 'production'
      ? winston.format.json()
      : winston.format.colorize(),
    config.env !== 'production' ? winston.format.simple() : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
