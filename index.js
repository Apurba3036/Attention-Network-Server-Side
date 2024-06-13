const express=require('express');
const cors=require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app=express();
const port=process.env.PORT || 5000;

//middleware

app.use(cors());
app.use(express.json());
// console.log(process.env.ACCESS_TOKEN_SECRET);

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
    const bookingcollection=client.db('AttentionNetwork').collection('bookings')


  //jwt routes
  app.post('/jwt',(req,res)=>{
    const user=req.body;
    console.log(user);
    const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
      expiresIn: '24h'
    });
    res.send({token});
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
            
            // Include only the `title` and `imdb` fields in the returned document
            projection: { image:1,title: 1,description:1 },
          };
        const result=await servicecollection.findOne(query,options);
        res.send(result);
    })

    //bookings
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