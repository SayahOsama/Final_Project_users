import { createServer, IncomingMessage, ServerResponse } from "http";
import * as mongoose from "mongoose";
import * as dotenv from "dotenv";
import { createOrder, createUser, deleteOrder, getOrders, getUserByIdOrName, mainRoute, updatePrivileges } from "./routes.js";
import { PublisherChannel } from './publisher-channel.js';
import cors from "cors";

// For environment-variables
dotenv.config();
const port = process.env.PORT;

// Connect to mongoDB
const dbURI = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@pws.jqme9mr.mongodb.net/Final_Project`;
await mongoose.connect(dbURI);

const publisherChannel = new PublisherChannel();

const server = createServer((req: IncomingMessage, res: ServerResponse) => {

  cors({
    origin: "https://final-project-gateway.onrender.com"
  })(req, res, () => {});

  if (req.url.match(/\/api\/user\/orders\/[\w=&?]+/)) {
    if(req.method === "GET"){
      getOrders(req,res);
      return;
    }
    if(req.method === "POST"){
      createOrder(req,res);
      return;
    }
    if(req.method === "DELETE"){
      deleteOrder(req,res,publisherChannel);
      return;
    }
  }

  if (req.url.match(/\/api\/user\/permission/)) {
    if(req.method === "PUT"){
      updatePrivileges(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/user\/\w+/)) {
    if(req.method === "GET"){
      getUserByIdOrName(req,res);
      return;
    }
  }

  if (req.url.match(/\/api\/user/)) {
    if(req.method === "GET"){
      mainRoute(req,res);
      return;
    }
    if(req.method === "POST"){
      createUser(req,res);
      return;
    }
  }
  
  res.statusCode = 404;
  res.end("route does not exist");

});

server.listen(port);
console.log(`Server running! port ${port}`);
