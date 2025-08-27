const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://all-it-shop-clint.vercel.app'
  ],
  credentials: true
}));
// CORS middleware




app.use(express.json());
app.use(cookieParser());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jfgqsm5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");
    
    const usersCollection = client.db('AL-IT-SHOPPING').collection('users');
    const usersPostCollection = client.db('AL-IT-SHOPPING').collection('Posts');
    const orderConfirmCollection = client.db('AL-IT-SHOPPING').collection('orderconfirm');
    const orderFinalizedCollection = client.db('AL-IT-SHOPPING').collection('orderfinalized');
    const ProcessToPayment = client.db('AL-IT-SHOPPING').collection('confirmPayment');


// ✅ POST Billing Details + Orders
app.post('/checkout/finalize/:userId', async (req, res) => {
  const { userId } = req.params;
  const { orders, billing } = req.body;

  if (!userId || !orders || !billing) {
    return res.status(400).send({ error: 'Invalid request data' });
  }

  const paymentData = {
    userId,
    orders,
    billing,
    status: 'pending', // You can later update to "paid" after actual payment integration
    totalAmount: orders.reduce((acc, item) => acc + item.price * item.quantity, 0),
    createdAt: new Date()
  };

  try {
    const result = await ProcessToPayment.insertOne(paymentData);
    res.send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Error inserting payment data:', error);
    res.status(500).send({ error: 'Failed to process payment' });
  }
});
// Get all checkout/finalize records for a specific user
app.get('/checkout/finalize/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const userPayments = await ProcessToPayment.find({ userId }).toArray();
    res.send({ success: true, payments: userPayments });
  } catch (err) {
    console.error('Error fetching payment data:', err);
    res.status(500).send({ success: false, message: 'Failed to fetch payment data' });
  }
});


// Delete single finalized order
app.delete('/finalizedorders/:userId/:orderId', async (req, res) => {
  const { userId, orderId } = req.params;
  try {
    await orderFinalizedCollection.deleteOne({ _id: new ObjectId(orderId), userId });
    res.send({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to delete order' });
  }
});

// Delete all finalized orders for a user
app.delete('/finalizedorders/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    await orderFinalizedCollection.deleteMany({ userId });
    res.send({ success: true, message: 'All orders deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to delete all orders' });
  }
});

    // -------------------------
    // Add post to user cart
    app.post('/posts/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const post = req.body;
        if (userId !== post.userId) return res.status(400).send({ message: 'User ID mismatch' });

        const existing = await usersPostCollection.findOne({ userId, id: post.id });
        if (existing) return res.status(409).send({ message: 'Product already in cart' });

        const result = await usersPostCollection.insertOne(post);
        res.send({ message: 'Post added successfully', postId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Get posts for user
    app.get('/posts/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const userPosts = await usersPostCollection.find({ userId }).toArray();
        res.send(userPosts);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Delete single post
    app.delete('/posts/:postId', async (req, res) => {
      try {
        const { postId } = req.params;
        if (!ObjectId.isValid(postId)) return res.status(400).send({ message: 'Invalid post ID' });

        const result = await usersPostCollection.deleteOne({ _id: new ObjectId(postId) });
        if (result.deletedCount === 0) return res.status(404).send({ message: 'Post not found' });

        res.send({ message: 'Post deleted successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });


    // Confirm single order
    app.post('/confirmorder', async (req, res) => {
      try {
        const { userId, productId, quantity } = req.body;
        if (!userId || !productId || !quantity)
          return res.status(400).send({ message: 'userId, productId, quantity required' });

        const existing = await orderConfirmCollection.findOne({ userId, productId });
        if (existing) return res.status(409).send({ message: 'Order already confirmed' });

        const result = await orderConfirmCollection.insertOne({
          userId, productId, quantity, confirmedAt: new Date()
        });

        res.send({ success: true, message: 'Order confirmed', orderId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error during order confirm' });
      }
    });

    // Cancel order
    app.delete('/confirmorder/:productId', async (req, res) => {
      try {
        const { productId } = req.params;
        const { userId } = req.query;
        if (!userId || !productId) return res.status(400).send({ message: 'userId and productId required' });

        const result = await orderConfirmCollection.deleteOne({ userId, productId });
        if (result.deletedCount === 0) return res.status(404).send({ message: 'Order not found' });

        res.send({ success: true, message: 'Order canceled successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error during cancel order' });
      }
    });

    // Finalize all confirmed orders
    app.post('/confirmorder/finalize', async (req, res) => {
      try {
        const { userId, orders } = req.body;
        if (!userId || !orders || !Array.isArray(orders))
          return res.status(400).send({ message: 'userId and orders array required' });

         // Map orders with full product info
    const finalOrders = orders.map(order => ({
      userId,
      productId: order.productId,
      name: order.name,             // added
      description: order.description, // added
      image: order.image,           // added
      price: order.price,
      quantity: order.quantity,
      finalizedAt: new Date()
    }));

        // Store in finalized collection
        await orderFinalizedCollection.insertMany(finalOrders);

        // Optionally remove from confirm collection
        await orderConfirmCollection.deleteMany({
          userId,
          productId: { $in: orders.map(o => o.productId) }
        });

        res.send({ success: true, message: 'All confirmed orders finalized successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error during finalize orders' });
      }
    });

   // Get finalized orders
    app.get('/finalizedorders/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const finalizedOrders = await orderFinalizedCollection.find({ userId }).toArray();
        res.send(finalizedOrders);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error during fetching finalized orders' });
      }
    });

    // Update quantity or delete
 app.put('/finalizedorders/:userId/:orderId', async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const { quantity } = req.body;

    await orderFinalizedCollection.updateOne(
      { _id: new ObjectId(orderId), userId: userId }, // OrderId কে ObjectId বানানো
      { $set: { quantity } }
    );

    res.send({ success: true, message: 'Quantity updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to update quantity' });
  }
});

    app.delete('/finalizedorders/:userId/:orderId', async (req, res) => {
      try {
        const { userId, orderId } = req.params;
        await orderFinalizedCollection.deleteOne({ _id: new ObjectId(orderId), userId });
        res.send({ success: true, message: 'Order deleted successfully' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to delete order' });
      }
    });

    // Finalize payment + save billing
   

  
    

    // -------------------------
    // USER AUTH ROUTES
    app.post('/signup', async (req, res) => {
      try {
        const user = req.body;
        if (!user.email || !user.password)
          return res.status(400).send({ message: 'Email and password are required' });

        const email = user.email.toLowerCase();
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.status(409).send({ message: 'Already used this email' });

        const result = await usersCollection.insertOne({ ...user, email });
        res.status(201).send({ message: 'User created successfully', userId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.post('/jwt', async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).send({ message: 'Email is required for JWT' });

        const user = await usersCollection.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).send({ message: 'User not found' });

        const token = jwt.sign(
          { _id: user._id.toString(), email: user.email, role: user.role || 'user' },
          process.env.JWT_SECURE,
          { expiresIn: '365d' }
        );

        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
          maxAge: 365 * 24 * 60 * 60 * 1000
        }).send({ success: true, message: 'JWT set in cookie' });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error during JWT creation' });
      }
    });

    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
      }).send({ success: true, message: "Logged out" });
    });
    

    // Test
    app.get('/', (req, res) => res.send('Hello World! from it-server final'));

    // Start server
    // app.listen(port, () => console.log(`Server running on port ${port}`));

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
module.exports = app;
