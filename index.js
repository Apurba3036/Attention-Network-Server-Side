const express=require('express');
const cors=require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const nodemailer = require("nodemailer");
const app=express();
const stripe=require('stripe')('sk_test_51PY5nKRrK5w1Alg4U9TiSmveJoHsSCUEoG5hxvOMacsQi9XxAgxACqANDwPe9mKhQKcroqeeJFxMs5ffGzCMBS0g00hyIrpFpU')
const port=process.env.PORT || 5000;
const admin = require('firebase-admin');
const serviceAccount = require('./attentionnetwork-860bc-firebase-adminsdk-45qja-40330006e6.json');
// const mg = require('nodemailer-mailgun-transport');


//middleware

app.use(cors());
app.use(express.json());
// console.log(process.env.ACCESS_TOKEN_SECRET);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//send email
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: "3d226c2f4053a6",
    pass: "ce563f436556f8",
  },
});

// const auth = {
//   auth: {
//     api_key: 'ca1185249963584ee0b0b8e074f5eb78-623e10c8-25bbc753',
//     domain: 'sandboxeddc626f57d8472bbfe506b665c24389.mailgun.org'
//   }
// }
// const transporter = nodemailer.createTransport(mg(auth));

// const sendconfirmationemail=(email)=>{
//   transporter.sendMail({
//     from: 'otilia.effertz@ethereal.email', // sender address
//     to:email, // list of receivers
//     subject: "Your payment ", // Subject line
//     text: "Hello world?", // plain text body
//     html: "<b>Hello world?</b>", // html body
//   });

// }
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wznn11w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyjwt=(req,res,next)=>{


  //  console.log(req.headers.authorization);
   const authorization=req.headers.authorization;
   if(!authorization){
     return res.status(401).send({error:true,message:"Unauthorized access"});
   }

   const token=authorization.split(' ')[1];
  //  console.log(token);
   jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(error,decoded)=>{
    if(error){
      return res.status(403).send({error:true,message:"unauthorized access"})
    }

    req.decoded=decoded;
    next();
   })

}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicecollection=client.db('AttentionNetwork').collection('services');
    const bookingcollection=client.db('AttentionNetwork').collection('bookings');
    const userscollection=client.db('AttentionNetwork').collection('users');
    const paymentcollection=client.db('AttentionNetwork').collection('payments');


  //jwt routes
  app.post('/jwt',(req,res)=>{
    const user=req.body;
    console.log(user);
    const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
      expiresIn: '24h'
    });
    res.send({token});
  })

  app.get('/users',async(req,res)=>{
    const result=await userscollection.find().toArray();
    res.send(result);
  })

   // Endpoint to save user token
   app.patch('/users/savetoken/:email', async (req, res) => {
    const usermail = req.params.email;
    const { token } = req.body; // Extract the token from the request body

    try {
        const filter = { email: usermail };
        const updateDoc = {
            $set: {
                token: token // Set the token from the request body
            }
        };

        const result = await userscollection.updateOne(filter, updateDoc);

        if (result.matchedCount > 0) {
            res.status(200).json({ message: 'Token updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating token:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


  // Endpoint to send notifications
  app.post('/api/send-notification', async (req, res) => {
    const { userId, title, body } = req.body;
    const user = await userscollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user || !user.token ) {
      return res.status(404).send('Token not found for user');
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      token: user.token
    };

    try {
      await admin.messaging().send(message);
      res.status(200).send('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).send('Error sending notification');
    }
  });

  //admin related api

  app.get('/admin-stats',async(req,res)=>{
    const users=await userscollection.estimatedDocumentCount();
    const services=await servicecollection.estimatedDocumentCount();
    const payments= await paymentcollection.estimatedDocumentCount();
    const bookings=await bookingcollection.estimatedDocumentCount();
    
    const allpayments=await paymentcollection.find().toArray();
    const revenue= allpayments.reduce((sum,payment)=>sum+payment.totalprice,0);
    res.send({
      users,
      services,
      payments,
      bookings,
      revenue
    })

  })

 

  //users related api

  app.post('/users',async(req,res)=>{
    const user=req.body;
    const query={email:user.email}
    const existingUser=await userscollection.findOne(query);
    if(existingUser){
      return res.send({message:"user already exist"})
    }
    const result=userscollection.insertOne(user);
    res.send(result);
  })

  app.get('/users/admin/:email',verifyjwt,async(req,res)=>{

    const email=req.params.email;
    if(req.decoded.email !==email){
        res.send({admin:false})
    }
    const query={email: email}
    const user=await userscollection.findOne(query);
    const result={admin: user?.role==='admin'}
    res.send(result);
  })

  app.patch('/users/admin/:id',async(req,res)=>{
    const id=req.params.id;
    const filter={_id: new ObjectId(id)};
    const updateDoc={
      $set:{
        role: 'admin'
      }
    }

    const result=await userscollection.updateOne(filter,updateDoc);
    res.send(result)
  })

    app.get('/services',async(req,res)=>{

        const cursor=servicecollection.find();
        const result=await cursor.toArray();
        res.send(result);
    })


    app.get('/services/:id',async(req,res)=>{

        const id=req.params.id;
        const query={_id:new ObjectId(id)}

        const options = {
            
           
            projection: { image:1,title: 1,description:1,price:1 },
          };
        const result=await servicecollection.findOne(query,options);
        res.send(result);
    })

    //bookings
  app.get('/allBookings',async(req,res)=>{
    const result=await bookingcollection.find().toArray();
    res.send(result);
  })
    app.get('/bookings',verifyjwt,async(req,res)=>{
      // console.log(req.headers.authorization);
      const decoded=req.decoded;
      if(decoded.email !==req.query.email){
        return res.status(403).send({error:1,message:"forbidden access"})
      }
      // console.log("came back",decoded);
        let query={};
        if(req.query?.email){
          query={email: req.query.email}
        }
        const result=await bookingcollection.find(query).toArray();
        res.send(result);
    })
    app.post('/bookings',async(req,res)=>{

        const booking=req.body;
        console.log(booking);
        const result=await bookingcollection.insertOne(booking);
        res.send(result)
    });

    //delete
    app.delete('/bookings/:id', async(req,res)=>{

         const id=req.params.id;
         const query={_id:new ObjectId(id) };
         const result=await bookingcollection.deleteOne(query);
         res.send(result)

    });

    

    //payment intent

    app.post('/create-payment-intent',async(req,res)=>{
      const {price}=req.body;
      const amount=price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        
        currency: "usd",
        payment_method_types: ['card']
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.post('/payments',async(req,res)=>{

      const payment=req.body;
      const result=await paymentcollection.insertOne(payment);
      const query={_id: {$in: payment.bookingsitems.map(id=>new ObjectId(id))}}
      const deleteResult=await bookingcollection.deleteMany(query);
      transporter.sendMail({
    from: 'nazmussakibapurbo@gmail.com', // sender address
    to:payment.email, // list of receivers
    subject: "Your payment ", // Subject line
    text: "Hello world?", // plain text body
    html: "<b>Hello world?</b>", // html body
  });

      res.send({result,deleteResult});
    })

    app.get('/payments', async (req, res) => {
      try {
        const payments = await paymentcollection.find().toArray();
        res.send(payments);
      } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).send({ error: true, message: 'Internal server error' });
      }
    });
    


    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Server is running')
})

app.listen(port,()=>{
    console.log("Attention networking server is running");
})