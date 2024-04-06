import { IncomingMessage, ServerResponse } from "http";
import User from "./models/users.js";
import * as bcrypt from "bcrypt";
import { PublisherChannel } from "./publisher-channel.js";
import mongoose from "mongoose";

const parseSearchParams = (url: string): { [key: string]: string } => {
  const searchParams: { [key: string]: string } = {};

  if (url) {
    const queryIndex = url.indexOf("?");

    if (queryIndex !== -1) {
      const queryString = url.slice(queryIndex + 1);
      const queryParams = queryString.split("&");

      queryParams.forEach((pair) => {
        const [key, value] = pair.split("=");
        searchParams[key] = decodeURIComponent(value);
      });
    }
  }

  return searchParams;
};

export const mainRoute = (req: IncomingMessage, res: ServerResponse) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.write("<h1>Users API Documentation</h1>");
  res.write(`<ul>
              <li>GET /api/user - Get the main root.</li>
              <li>GET /api/user/{id} - Get the user by user ID.</li>
              <li>GET /api/user/{username} - Get the user by username.</li>
              <li>GET /api/user/orders/{id} - Get the orders by user ID.</li>
              <li>POST /api/user - Create a new user.</li>
              <li>POST /api/user/orders/{id}- Create a new order by user ID.</li>
              <li>PUT /api/user/permissions - Update user permissions.</li>
              <li>DELETE /api/user/orders/{id} - Delete order by user ID (for refunds).</li>
            </ul>`);
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.end();
  return;
};

export const deleteOrder = (req: IncomingMessage, res: ServerResponse,publisherChannel: PublisherChannel) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let id;
  const { url } = req;
  if (url) {
    const urlParts = url.split("/");
    const IdOrNameIndex = urlParts.indexOf("orders") + 1;
    id = decodeURIComponent(urlParts[IdOrNameIndex]);
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    let orderID;
    try {
      orderID = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }

    const bodyKeys = Object.keys(orderID);
    if (!bodyKeys.includes("orderID")) {
      res.statusCode = 400;
      res.end("Request body must contain the required fields.");
      return;
    }

    const orderToDelete = orderID.orderID;

   
    try {
      // Find the user by ID
      const user = await User.findById(id).select('-orders');
      if (!user) {
          res.statusCode = 404;
          res.end("User does not exist.");
          return;
      }

      const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor
      const objectOrderId = new ObjectId(orderToDelete);
      const objectId = new ObjectId(id);

      const order = await User.aggregate([
        { $match: { _id: objectId } }, // Match the user by ID
        { $unwind: '$orders' }, // Unwind the orders array
        { $match: { 'orders._id': objectOrderId } } // Match the order by its orderID
      ]);
      if (order.length > 0) {
         // Publish event:
        await publisherChannel.sendEvent(JSON.stringify(order[0].orders));
      }

      // Update the user document to pull the order from the orders array
      const result = await User.updateOne(
        { _id: objectId }, // Assuming `id` is the user's ID
        { $pull: { orders: { _id: objectOrderId } } } // Assuming `orderToDelete` is the ID of the order to delete
      );

      // Check if the update was successful
      if (result.modifiedCount  === 1) {
          res.statusCode = 204; // Deleted successfully
          res.end("Order deleted successfully.");
      } else {
          res.statusCode = 404; // No order found for deletion
          res.end("Order not found for deletion.");
      }
      } catch (error) {
          console.error("Error Deleting order:", error);
          res.statusCode = 500;
          res.end("Internal server error.");
      }
  });
};

export const createOrder = (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers
 res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let id;
  const { url } = req;
  if (url) {
    const urlParts = url.split("/");
    const IdOrNameIndex = urlParts.indexOf("orders") + 1;
    id = decodeURIComponent(urlParts[IdOrNameIndex]);
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    let order;
    try {
      order = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }

    const bodyKeys = Object.keys(order);
    if (!bodyKeys.includes("start_date") || !bodyKeys.includes("orderID") || !bodyKeys.includes("eventID") || !bodyKeys.includes("ticketType") || !bodyKeys.includes("ticketQuantity")) {
      res.statusCode = 400;
      res.end("Request body must contain the required fields.");
      return;
    }

    const orderID = order.orderID;
    const eventID = order.eventID;
    const ticketType = order.ticketType;
    const ticketQuantity = order.ticketQuantity;
    const start_date = order.start_date;
   
    try {
      // Find the user by ID
      const user = await User.findById(id).select('-orders');
      if (!user) {
          res.statusCode = 404;
          res.end("User does not exist.");
          return;
      }

      // Create a new order
      const newOrder = {
          orderID: orderID,
          eventID: eventID,
          ticketType: ticketType,
          ticketQuantity: ticketQuantity,
          start_date: start_date,
      };

      // Update the user document to push the new order to the orders array
      const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor
      const objectId = new ObjectId(id);
      const result = await User.updateOne(
        { _id: id },
        { $push: { orders: newOrder } }
      );
      if (!result) {
        res.statusCode = 500;
        res.end("failed to create new order.");
        return;
    }
      res.statusCode = 201; // Created a new order!
      res.end("Order created successfully.");
      } catch (error) {
          console.error("Error creating order:", error);
          res.statusCode = 500;
          res.end("Internal server error.");
      }
  });
};

export const getOrders = async (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers
 res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let skip = 0;
  let limit = 50;
  let id;
  const { url } = req;
  if (url) {
    const searchParams = parseSearchParams(url);
    if(searchParams["skip"]){
      skip = parseInt(searchParams["skip"]);
      if(skip < 0) skip = 0;
    }
    if(searchParams["limit"]){
      limit = parseInt(searchParams["limit"]);
      if(limit <= 0 || limit >= 50) limit = 50;
    }
    const urlParts = url.split("?")[0].split("/");
    const IdOrNameIndex = urlParts.indexOf("orders") + 1;
    id = decodeURIComponent(urlParts[IdOrNameIndex]);
  }
  try{
    const ObjectId = mongoose.Types.ObjectId; // Get the ObjectId constructor
    const userIdObj = new ObjectId(id);
    const orders = await User.aggregate([
      { $match: { _id: userIdObj } },
      { $unwind: "$orders" },
      { $sort: { "orders.timeOfPurchase": -1 } }, // Sort orders by timeOfPurchase in descending order
      { $skip: skip }, // Skip records
      { $limit: limit }, // Limit records
      { $replaceRoot: { newRoot: "$orders" } } // Replace the root document with the orders
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(orders));
  }catch(error){
    res.statusCode = 400;
    res.end(error.message);
    return;
  }
};

export const getUserByIdOrName = async (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let IdOrName;
  const { url } = req;
  if (url) {
    const urlParts = url.split("/");
    const IdOrNameIndex = urlParts.indexOf("user") + 1;
    IdOrName = decodeURIComponent(urlParts[IdOrNameIndex]);
  }
  let user;
  try{
    const id = IdOrName;
    user = await User.findById(id).select('-orders');
    if(user){
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(user));
      return;
    }
  }catch(error){}
  
  try{
    user = await User.findOne({ username: IdOrName }).select('-orders');
  }catch(error){
    res.statusCode = 400;
    res.end(error.message);
    return;
  }

    
  res.statusCode = 200;
  res.end(
    JSON.stringify(user)
  );
  return;
};

export const createUser = (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    let credentials;
    try {
      credentials = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }

    const bodyKeys = Object.keys(credentials);
    if (!bodyKeys.includes("username") || !bodyKeys.includes("password")) {
      res.statusCode = 400;
      res.end("Request body must contain only 'username' and 'password' fields.");
      return;
    }

    const username = credentials.username;
    const password = await bcrypt.hash(credentials.password, 10);
    if(username.length == 0){
      res.statusCode = 400;
      res.end("Invalid username");
      return;
    }

    if(credentials.password.length == 0){
      res.statusCode = 400;
      res.end("Invalid password");
      return;
    }

    const existingUser = await User.findOne({ username }).select('-orders');
    if (existingUser) {
      res.statusCode = 400;
      res.end("Username already exists");
      return;
    }

    // Create a new user document
    const newUser = new User({
      username: username,
      password: password,
      permission: "U"
    });

    // Save the user to the database
    await newUser.save();

    res.statusCode = 201; // Created a new user!
    res.end(
      JSON.stringify({
        username,
      })
    );
  });
};

export const updatePrivileges = (req: IncomingMessage, res: ServerResponse) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://osama-sayah.github.io');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    // Parse request body as JSON
    let privilege;
    try {
      privilege = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end("Invalid JSON format in request body.");
      return;
    }

    const bodyKeys = Object.keys(privilege);
    if (!bodyKeys.includes("loggedUserName") || !bodyKeys.includes("username") || !bodyKeys.includes("permission")) {
      res.statusCode = 400;
      res.end("Request body must contain only 'username' and 'permission' and 'loggedUserName' fields.");
      return;
    }
    // Query the User collection for a user with the specified username
    const loggedUserName = privilege.loggedUserName;
    const loggedUser = await User.findOne({ loggedUserName }).select('-orders');
    const username = privilege.username;
    const permission = privilege.permission;
    const existingUser = await User.findOne({ username }).select('-orders');
    if(username == "admin"){
      res.statusCode = 400;
      res.end("cant update admin permission");
      return;
    }
    if (!existingUser) {
      res.statusCode = 404;
      res.end("User does not exist");
      return;
    }
    
    if(loggedUser.permission && loggedUser.permission != "A"){
      res.statusCode = 403;
      res.end("you lack sufficient permissions to update privilege.");
      return;
    }

    if(permission == "A"){
      res.statusCode = 400;
      res.end("you are forbidden to grant this permission.");
      return;
    }

    if(permission != "M" && permission != "W" && permission != "U"){
      res.statusCode = 400;
      res.end("there is no such permission.");
      return;
    }
    
    existingUser.permission = permission;
    await existingUser.save();
    res.statusCode = 200;
    res.end("successfully updated the privileges");
    return;
  });
};

