import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { createOrder, createUser, deleteOrder, getOrders, getUserByIdOrName, mainRoute, updatePrivileges } from './routes.js';
import { PublisherChannel } from './publisher-channel.js';

dotenv.config();
const app = express();
const port = process.env.PORT;

// Connect to MongoDB
const dbURI = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@pws.jqme9mr.mongodb.net/Final_Project`;
await mongoose.connect(dbURI);

const publisherChannel = new PublisherChannel();

// CORS middleware
app.use(cors({
  origin: ['https://SayahOsama.github.io','https://final-project-gateway.onrender.com','https://SayahOsama.github.io/Final_Project_App']
}));

// Routes
app.get('/api/user/orders/:Id', getOrders);
app.post('/api/user/orders/:Id', createOrder);
app.delete('/api/user/orders/:Id', (req, res) => {
  deleteOrder(req, res, publisherChannel);
});
app.put('/api/user/permission', updatePrivileges);
app.get('/api/user/:userIdOrName', getUserByIdOrName);
app.get('/api/user', mainRoute);
app.post('/api/user', createUser);

// Handle 404 - Not Found
app.use((req, res) => {
  res.status(404).send('Route does not exist');
});

app.listen(port, () => {
  console.log(`Server running! port ${port}`);
});
