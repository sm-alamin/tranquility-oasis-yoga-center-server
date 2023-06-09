const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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

    //user related api

    //user post api
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

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
    // cart collection get apis
    app.get("/carts", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    //cart collection post api
    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });
    //cart collection delete api
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
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
