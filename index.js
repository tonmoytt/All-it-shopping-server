const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors') 
const dotenv=require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors())  
app.use(express.json()) 


// mongodb


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jfgqsm5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

 const usersCollection = client.db('AL-IT-SHOPPING').collection('users');

 
// POST রিকোয়েস্ট - ইউজার ডাটা সেভ করার জন্য
app.post('/signup', async (req, res) => {
  try {
    const user = req.body;

    // Optional: ভ্যালিডেশন যোগ করতে পারো এখানে
    if (!user.email || !user.password) {
      return res.status(400).send({ message: 'Email and password are required' });
    }

    // ইমেইল দিয়ে ইউজার আগে থেকে আছে কিনা চেক করা (optional)
    const existingUser = await usersCollection.findOne({ email: user.email });
    if (existingUser) {
      return res.status(409).send({ message: 'User already exists' });
    }

    // ইউজার ইনসার্ট করা
    const result = await usersCollection.insertOne(user);

    res.status(201).send({ message: 'User created successfully', userId: result.insertedId });
  } catch (error) {
    console.error('Error in /signup:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});





    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
