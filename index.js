const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jodl5p0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    //users db
    const usersCollection = client.db("yogaDb").collection("usersInfo");
    //course db
    const courseCollection = client.db("yogaDb").collection("courseInfo");
    //instructors db
    const instructorsCollection = client
      .db("yogaDb")
      .collection("instructorsInfo");
    const cartCollection = client.db("yogaDb").collection("carts");
    const paymentCollection = client.db("yogaDb").collection("payments");

    // jwt token post api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });
    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    //verify instructor
    

    //user related api

    // Get all users (admin only)
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //Create a user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
    
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
    
      user.role = "";
    
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Check if a user is an admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    // Check if a user is an instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    
    //Update user role to "admin"
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //  Update user role to "instructor"
    app.patch(
      "/users/instructor/:id",
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "instructor",
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    //Class related api
    //read class data
    app.get("/courses", async (req, res) => {
      const limit = parseInt(req.query.limit);

      let cursor;
      if (limit && limit > 0) {
        cursor = courseCollection
          .find()
          .sort({ number_of_enrolled_students: -1 })
          .limit(limit);
      } else {
        cursor = courseCollection.find();
      }

      const result = await cursor.toArray();
      res.send(result);
    });
    //post class data
    app.post("/courses", verifyJWT, async (req, res) => {
      const newClass = {
        ...req.body,
        status: "pending", 
        total_enrolled_student: 0 
      };
      const result = await courseCollection.insertOne(newClass);
      res.send(result);
    });
    
    //common api to get all classes by id
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });
    app.post('/courses/:id/feedback', async (req, res) => {
      const id = req.params.id;
      const { message } = req.body;
    
      try {
        // Update the course with the provided ID and set the feedback message
        await courseCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { feedback: message } }
        );
        res.sendStatus(200); // Send a success response
      } catch (error) {
        console.error('Failed to update course with feedback:', error);
        res.status(500).send('Internal server error');
      }
    });
    
    app.patch("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const { operation, ...data } = req.body; // Extract the operation from the request body
    
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      let updatedCourses = {};
    
      // Based on the operation, set the appropriate fields in updatedCourses
      switch (operation) {
        case 'approve':
          updatedCourses = {
            $set: {
              status: 'approved'
            },
          };
          break;
        case 'deny':
          updatedCourses = {
            $set: {
              status: 'denied'
            },
          };
          break;
        case 'feedback':
          const { message } = data;
          updatedCourses = {
            $set: {
              feedback: message
            },
          };
          break;
        // Add more cases for other operations if needed
        default:
          return res.status(400).send('Invalid operation');
      }
    
      try {
        const result = await courseCollection.updateOne(filter, updatedCourses, options);
        res.send(result);
      } catch (error) {
        console.error('Failed to update class:', error);
        res.status(500).send('Internal server error');
      }
    });
    
    
    //update class data
    // app.patch("/courses/:id", verifyJWT, async (req, res) => {
    //   const id = req.params.id;
    //   const classInfo = req.body;
    //   console.log(id, classInfo);
    //   const filter = { _id: new ObjectId(id) };
    //   const options = { upsert: true };
    //   const updatedClassInfo = {
    //     $set: {
    //       class_name: classInfo.class_name,
    //       price: classInfo.price,
    //       available_seats: classInfo.available_seats,
    //       image: classInfo.image,
    //     },
    //   };
    //   const result = await courseCollection.updateOne(
    //     filter,
    //     updatedClassInfo,
    //     options
    //   );
    //   res.send(result);
    // });
    
    
    
    //delete class data
    app.delete(
      "/courses/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await courseCollection.deleteOne(query);
        res.send(result);
      }
    );

    //Class related api
    //read instructor data
    app.get("/instructors", async (req, res) => {
      const limit = parseInt(req.query.limit);

      let cursor;
      if (limit && limit > 0) {
        cursor = instructorsCollection
          .find()
          .sort({ total_students: -1 })
          .limit(limit);
      } else {
        cursor = instructorsCollection.find();
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    //cart collection api
    // Get cart items for a specific email
    app.get("/carts", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    //Add an item to the cart
    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });
    //Delete an item from the cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related get api
    app.get('/payments', async (req, res) => {
      const email = req.query.email;
    
      if (!email) {
        res.send([]);
      }
    
      const query = { email: email };
      const sort = { date: -1 }; // Sort by the "date" field in descending order
      const result = await paymentCollection.find(query).sort(sort).toArray();
      res.send(result);
    });
    
    // payment post api
    // app.post('/payments', verifyJWT, async (req, res) => {
    //   try {
    //     const payment = req.body;
    //     const insertResult = await paymentCollection.insertOne(payment);
    
    //     const cartItemId = payment.cartItemId; 
    
    //     if (!cartItemId) {
    //       throw new Error('No cart item ID provided');
    //     }
    
    //     const deleteResult = await cartCollection.deleteOne({
    //       _id: new ObjectId(cartItemId)
    //     });
    
    //     if (deleteResult.deletedCount === 0) {
    //       throw new Error('Cart item not found');
    //     }
    //     res.send({ insertResult, deleteResult });
    //   } catch (error) {
    //     res.status(500).send({ error: error.message });
    //   }
    // })

    app.post('/payments', verifyJWT, async (req, res) => {
      try {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);
    
        const cartItemId = payment.cartItemId; 
    
        if (!cartItemId) {
          throw new Error('No cart item ID provided');
        }
    
        const deleteResult = await cartCollection.deleteOne({
          _id: new ObjectId(cartItemId)
        });
    
        if (deleteResult.deletedCount === 0) {
          throw new Error('Cart item not found');
        }
    
        // Increase enrolled_student count in courseCollection
        const courseId = payment.classItemId; // Assuming courseId is provided in the payment request
        const courseQuery = { _id: new ObjectId(courseId) };
        const updateResult = await courseCollection.updateOne(courseQuery, { $inc: { total_enrolled_student: 1 } });
    
        if (updateResult.modifiedCount === 0) {
          throw new Error('Failed to update enrolled_student count');
        }
    
        res.send({ insertResult, deleteResult, updateResult });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
    
    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//test
app.get("/", (req, res) => {
  res.send("Tranquility oasis yoga center Server is running...");
});

app.listen(port, () => {
  console.log(
    `Tranquility oasis yoga center Server is running on port ${port}`
  );
});
